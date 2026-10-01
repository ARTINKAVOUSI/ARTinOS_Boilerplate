/** Save text as a file through the browser's download, e.g. an exported JSON. */
export function downloadText(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
