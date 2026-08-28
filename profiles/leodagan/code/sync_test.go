package pipeline

import (
	"context"
	"errors"
	"testing"
)

type stubSource struct{ records []Record }

func (s stubSource) Fetch(context.Context, string) ([]Record, error) { return s.records, nil }

type stubSink struct {
	failFirst int
	calls     int
	written   int
}

func (s *stubSink) Write(_ context.Context, batch []Record) error {
	s.calls++
	if s.calls <= s.failFirst {
		return errors.New("network")
	}
	s.written += len(batch)
	return nil
}

func records(n int) []Record {
	out := make([]Record, n)
	for i := range out {
		out[i] = Record{RemoteID: string(rune('a' + i%26))}
	}
	return out
}

func TestSynchronize(t *testing.T) {
	cases := []struct {
		name      string
		records   int
		opts      Options
		failFirst int
		wantDone  int
		wantBatch int
		wantErr   bool
	}{
		{name: "empty source writes nothing", records: 0, opts: Options{BatchSize: 10}},
		{name: "one partial batch", records: 7, opts: Options{BatchSize: 10}, wantDone: 7, wantBatch: 1},
		{name: "exact multiple of the batch size", records: 20, opts: Options{BatchSize: 10}, wantDone: 20, wantBatch: 2},
		{name: "resumes after the acknowledged batch", records: 30, opts: Options{BatchSize: 10, ResumeFrom: 2}, wantDone: 10, wantBatch: 3},
		{name: "retries a failed batch then carries on", records: 10, opts: Options{BatchSize: 10, Retries: 3}, failFirst: 2, wantDone: 10, wantBatch: 1},
		{name: "gives up after the last attempt", records: 10, opts: Options{BatchSize: 10, Retries: 2}, failFirst: 5, wantErr: true},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			sink := &stubSink{failFirst: c.failFirst}
			res, err := Synchronize(context.Background(), stubSource{records(c.records)}, sink, "src", c.opts)

			if c.wantErr {
				if err == nil {
					t.Fatal("expected an error, got none")
				}
				if sink.written != 0 {
					t.Fatalf("a failed batch must not count as written, got %d", sink.written)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res.Done != c.wantDone {
				t.Errorf("done = %d, want %d", res.Done, c.wantDone)
			}
			if res.LastBatch != c.wantBatch {
				t.Errorf("last acknowledged batch = %d, want %d", res.LastBatch, c.wantBatch)
			}
		})
	}
}
