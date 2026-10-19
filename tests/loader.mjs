// Lets Node import our source files the way Vite does (without ".js" at the end).
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  if (relative && !/\.[a-z]+$/i.test(specifier)) {
    for (const extension of ['.js', '.jsx']) {
      const url = new URL(specifier + extension, context.parentURL)
      if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
    }
  }
  return nextResolve(specifier, context)
}
