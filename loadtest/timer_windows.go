//go:build windows

package main

import "syscall"

var (
	winmm           = syscall.NewLazyDLL("winmm.dll")
	timeBeginPeriod = winmm.NewProc("timeBeginPeriod")
)

func enableHighResSleep() {
	_, _, _ = timeBeginPeriod.Call(1)
}
