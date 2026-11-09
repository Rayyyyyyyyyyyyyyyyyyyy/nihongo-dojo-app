import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// sha256 of `git show aadd243:public/data/<file>` in NHK-N3-1 (aadd2434f234b9400bd53f0dfb67856c3691fa83).
// Byte-identical files mean every ID, word and question is the web version's.
const nhk = {
  'counts.json': 'b7dd5b59ab5c41dd170b091857a02b752dbf70fa701be4c1d45a1ec05ee72d66',
  'grammar-n1.json': '5f8fb3883acc810cacd0768ca038e4a7641b960ca6ee48dad6a0a4dd116b4997',
  'grammar-n2.json': '7184a755a3cb070a465d1a0970e0d4c4d9c50e2eac17143ed04aa45f29e3f18c',
  'grammar-n3.json': 'de6bdf5a82537d8bc1deeea46111da52096a3b48cab14d9d8f10e15851bbf047',
  'grammar-n4.json': 'c8ae017bc8c1fa5cbe490bd675985eb29e6ed0199a80eea125968c05a975546c',
  'grammar-n5.json': 'bdc5506ea2ba441e923ebbbab16c4f12aaa27f1587d9130fc53c0bd4604e3829',
  'listening.json': '04a86e6127e50d0b2d89c7f4060a43d4b9c134a31444c1293e6a902ca66f2574',
  'reading.json': '590c4bbafc62d03c4ba413539b05ec8871532a46f78c92c94298f71f2d4e6127',
  'vocab-n1.json': '236abe329225102d237735fc5c73b9ba3fde0499ffbc129f763883a2838d43e2',
  'vocab-n2.json': '4a8c633feb2f903f987268fa124ee6c2abeb795a7bc435c8f6be97235121e1ee',
  'vocab-n3.json': '12977176f4c788c27e5e1243d1fb54e36681211ad91a9d4f975af9395af9be3e',
  'vocab-n4.json': '1b55c72be7d3ea10efdc1b60603a7a7e26acf870aa908aaccab2db759cd3e870',
  'vocab-n5.json': '13964c88f5955deced6b5ac02017a4d015fc08798f6f5d237ae65e58a5973e7e',
}

it.each(Object.entries(nhk))('%s is byte-identical to NHK-N3-1 aadd243', (file, hash) => {
  const bytes = readFileSync(join(__dirname, '../../data/bank', file))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash)
})
