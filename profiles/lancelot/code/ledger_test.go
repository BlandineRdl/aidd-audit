package ledger

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeStore struct {
	exists    bool
	existsErr error
	insertErr error
	inserted  []Movement
}

func (s *fakeStore) Exists(_ context.Context, _ string) (bool, error) {
	return s.exists, s.existsErr
}

func (s *fakeStore) Insert(_ context.Context, m Movement) error {
	if s.insertErr != nil {
		return s.insertErr
	}
	s.inserted = append(s.inserted, m)
	return nil
}

func validMovement() Movement {
	return Movement{
		EventID:    "evt-1",
		AccountID:  "acc-1",
		Cents:      1250,
		Currency:   "EUR",
		OccurredAt: time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC),
	}
}

func TestRecordWritesTheMovement(t *testing.T) {
	s := &fakeStore{}
	if err := New(s).Record(context.Background(), validMovement()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(s.inserted) != 1 {
		t.Fatalf("expected 1 insert, got %d", len(s.inserted))
	}
}

func TestRecordRejectsAReplay(t *testing.T) {
	s := &fakeStore{exists: true}
	err := New(s).Record(context.Background(), validMovement())
	if !errors.Is(err, ErrAlreadyRecorded) {
		t.Fatalf("expected ErrAlreadyRecorded, got %v", err)
	}
}

func TestFieldValidation(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*Movement)
	}{
		{"empty event", func(m *Movement) { m.EventID = "" }},
		{"empty account", func(m *Movement) { m.AccountID = "" }},
		{"zero amount", func(m *Movement) { m.Cents = 0 }},
		{"bad currency", func(m *Movement) { m.Currency = "EURO" }},
		{"missing date", func(m *Movement) { m.OccurredAt = time.Time{} }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			m := validMovement()
			c.mutate(&m)
			s := &fakeStore{}
			if err := New(s).Record(context.Background(), m); err == nil {
				t.Fatal("expected an error, got nil")
			}
			if len(s.inserted) != 0 {
				t.Fatal("an invalid movement was inserted")
			}
		})
	}
}

// Added after review: this is the path that actually matters, since the
// existence check protects nothing against a concurrent replay.
func TestUniqueViolationCountsAsReplay(t *testing.T) {
	s := &fakeStore{insertErr: fakeUniqueViolation{}}
	err := New(s).Record(context.Background(), validMovement())
	if !errors.Is(err, ErrAlreadyRecorded) {
		t.Fatalf("expected ErrAlreadyRecorded, got %v", err)
	}
}

type fakeUniqueViolation struct{}

func (fakeUniqueViolation) Error() string    { return "pq: duplicate key value violates unique constraint" }
func (fakeUniqueViolation) SQLState() string { return "23505" }
