/** @file 防抖Hook - 延迟执行回调，避免频繁触发 */
import { useCallback, useRef, useEffect } from 'react'

export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number = 300,
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay)
  }, [delay]) as T
}
