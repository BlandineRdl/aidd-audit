package pipeline

import (
	"context"
	"fmt"
	"time"
)

type Record struct {
	RemoteID string
	Payload  []byte
}

type Source interface {
	Fetch(ctx context.Context, name string) ([]Record, error)
}

type Sink interface {
	Write(ctx context.Context, batch []Record) error
}

type Options struct {
	BatchSize  int
	Retries    int
	ResumeFrom int
	OnProgress func(done, total int)
}

type Result struct {
	Total     int
	Done      int
	LastBatch int
}

// Synchronize resumes from the last acknowledged batch rather than from the
// start: a run interrupted at 38,000 records out of 40,000 used to replay all of
// them, and the sink deduplicates on write but the source bills per read.
func Synchronize(ctx context.Context, src Source, sink Sink, name string, o Options) (Result, error) {
	if o.BatchSize <= 0 {
		o.BatchSize = 100
	}
	if o.Retries <= 0 {
		o.Retries = 3
	}

	records, err := src.Fetch(ctx, name)
	if err != nil {
		return Result{}, fmt.Errorf("fetching %s: %w", name, err)
	}

	res := Result{Total: len(records), LastBatch: o.ResumeFrom}

	for i := o.ResumeFrom * o.BatchSize; i < res.Total; i += o.BatchSize {
		end := min(i+o.BatchSize, res.Total)
		batch := records[i:end]

		if err := writeWithRetry(ctx, sink, batch, o.Retries); err != nil {
			return res, fmt.Errorf("batch %d: %w", res.LastBatch, err)
		}

		res.Done += len(batch)
		res.LastBatch++
		if o.OnProgress != nil {
			o.OnProgress(res.Done, res.Total)
		}
	}

	return res, nil
}

func writeWithRetry(ctx context.Context, sink Sink, batch []Record, retries int) error {
	var err error
	for attempt := 1; attempt <= retries; attempt++ {
		if err = sink.Write(ctx, batch); err == nil {
			return nil
		}
		if attempt == retries {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(1<<attempt) * 100 * time.Millisecond):
		}
	}
	return err
}
