// Package ledger records accounting movements.
//
// Movements now arrive through the event consumer (see internal/consumer)
// rather than an HTTP call: billing was decoupled from the order service in
// the spring.
package ledger

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// ErrAlreadyRecorded signals an event that has already been handled.
//
// Not an error in the strict sense: the bus replays messages, and a replay is
// normal operation. The caller catches this and acknowledges.
var ErrAlreadyRecorded = errors.New("movement already recorded")

type Movement struct {
	EventID   string
	AccountID string
	Cents     int64
	Currency  string
	OccurredAt time.Time
}

type Store interface {
	Insert(ctx context.Context, m Movement) error
	Exists(ctx context.Context, eventID string) (bool, error)
}

type Ledger struct {
	store Store
}

func New(store Store) *Ledger {
	return &Ledger{store: store}
}

// Record writes a movement, exactly once per event.
func (l *Ledger) Record(ctx context.Context, m Movement) error {
	if err := validate(m); err != nil {
		return fmt.Errorf("invalid movement: %w", err)
	}

	// The check and the insert are not atomic: two consumers replaying the
	// same event both get through here. The unique constraint on event_id is
	// what settles it, not this check — it only saves a round trip in the
	// common case.
	exists, err := l.store.Exists(ctx, m.EventID)
	if err != nil {
		return fmt.Errorf("reading event %s: %w", m.EventID, err)
	}
	if exists {
		return ErrAlreadyRecorded
	}

	if err := l.store.Insert(ctx, m); err != nil {
		if isUniqueViolation(err) {
			return ErrAlreadyRecorded
		}
		return fmt.Errorf("inserting movement %s: %w", m.EventID, err)
	}
	return nil
}

func validate(m Movement) error {
	if m.EventID == "" {
		return errors.New("empty event id")
	}
	if m.AccountID == "" {
		return errors.New("empty account id")
	}
	if m.Cents == 0 {
		return errors.New("zero amount")
	}
	if len(m.Currency) != 3 {
		return fmt.Errorf("currency %q is not ISO 4217", m.Currency)
	}
	if m.OccurredAt.IsZero() {
		return errors.New("missing occurrence date")
	}
	return nil
}
