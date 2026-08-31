package main

import (
	"context"
	"time"
)

const pacerTick = 2 * time.Millisecond

// pacer emits request slots from one goroutine.
type pacer struct {
	ch   chan struct{}
	done chan struct{}
}

func newPacer() *pacer {
	return &pacer{
		ch:   make(chan struct{}, 1<<18),
		done: make(chan struct{}),
	}
}

func (p *pacer) start(ctx context.Context, rpsAt func() float64) {
	go func() {
		defer close(p.done)
		p.produce(ctx, rpsAt)
	}()
}

func (p *pacer) produce(ctx context.Context, rpsAt func() float64) {
	tick := time.NewTicker(pacerTick)
	defer tick.Stop()
	last := time.Now()
	carry := 0.0
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-tick.C:
			rps := rpsAt()
			dt := now.Sub(last).Seconds()
			last = now
			if rps <= 0 {
				continue
			}
			carry += dt * rps
			n := int(carry)
			if n <= 0 {
				continue
			}
			carry -= float64(n)
			for i := 0; i < n; i++ {
				select {
				case <-ctx.Done():
					return
				case p.ch <- struct{}{}:
				}
			}
		}
	}
}

func (p *pacer) wait(ctx context.Context, rps float64) error {
	if rps < 0 {
		return ctx.Err()
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.ch:
		return nil
	}
}
