/**
 * Shared CLI runner for examples.
 *
 * Each example file defines an array of { name, run } entries and calls `runExamples()`.
 * Supports: run all, run by index, or list available examples.
 *
 * @example
 * ```ts
 * runExamples('data-retrieve', [
 *   { name: 'Basic retrieval', run: basicRetrieve },
 *   { name: 'Multi-tool matching', run: multiToolMatching },
 * ])
 * ```
 */

export interface Example {
  name: string
  run: () => Promise<void>
}

const SEPARATOR = '─'.repeat(60)

function printList(title: string, examples: Example[]) {
  console.log(`\n${title} — available examples:\n`)
  examples.forEach((ex, i) => console.log(`  ${i + 1}. ${ex.name}`))
  console.log()
}

export function runExamples(title: string, examples: Example[]) {
  const arg = process.argv[2]

  if (arg === '--list' || arg === '-l') {
    printList(title, examples)
    return
  }

  const run = async (items: Example[]) => {
    console.log(`\n${SEPARATOR}`)
    console.log(`  ${title}`)
    console.log(`${SEPARATOR}\n`)
    for (const ex of items) {
      console.log(`▸ ${ex.name}`)
      console.log()
      await ex.run()
      console.log()
    }
    console.log(SEPARATOR)
    console.log('  Done.')
    console.log(SEPARATOR)
  }

  if (arg) {
    const idx = Number(arg) - 1
    const ex = examples[idx]
    if (!ex) {
      console.error(`Error: example ${arg} not found.`)
      printList(title, examples)
      process.exit(1)
    }
    run([ex])
    return
  }

  run(examples)
}
