import type { VaultRecord } from '../../types/models';

// Committed vault-file image (format v1) used as a regression guard: if the
// container layout, the AAD or the payload shape ever changes, decoding these
// bytes fails. Generated once by encodeVaultFile with getRandomBytesAsync
// stubbed to the fixed nonce 00 01 02 … 0b.
//
// FIXTURE_KEY_HEX is a TEST CONSTANT, not a real secret: it protects nothing
// but these fixture bytes, which hold made-up data.
export const FIXTURE_KEY_HEX = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';

export const FIXTURE_RECORDS: VaultRecord[] = [
  {
    id: 'rec-login-1',
    title: 'Gmail',
    template: 'login',
    fields: [
      {
        id: 'f-1',
        label: 'Username',
        value: 'tria@example.com',
        kind: 'text',
      },
      {
        id: 'f-2',
        label: 'Password',
        value: 'correct horse battery staple',
        kind: 'secret',
      },
      {
        id: 'f-3',
        label: 'Website',
        value: 'https://mail.google.com',
        kind: 'url',
      },
    ],
    pinned: true,
    tags: ['email'],
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-02-01T12:30:00.000Z',
  },
  {
    id: 'rec-afm-1',
    title: 'ΑΦΜ',
    template: 'idNumber',
    fields: [
      {
        id: 'f-4',
        label: 'Αριθμός',
        value: '123456789',
        kind: 'number',
      },
      {
        id: 'f-5',
        label: 'Issuing authority',
        value: 'ΔΟΥ Θεσσαλονίκης',
        kind: 'text',
      },
    ],
    pinned: false,
    tags: ['φορολογία'],
    createdAt: '2026-01-11T09:00:00.000Z',
    updatedAt: '2026-01-11T09:00:00.000Z',
  },
  {
    id: 'rec-note-1',
    title: 'Σημείωση',
    template: 'note',
    fields: [
      {
        id: 'f-6',
        label: 'Content',
        value: 'Κωδικός αποθήκης: 4421 — "quotes" & <tags>',
        kind: 'multiline',
      },
    ],
    pinned: false,
    tags: ['work'],
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
  },
];

export const FIXTURE_BYTES_BASE64 =
  'SVZMVAEAEHsia2luZCI6InZhdWx0In0AAQIDBAUGBwgJCgs8IKZ6vImteukX8vnCgBcDoey2GNIJOh9XFYH2P1NbySN5yt6V' +
  '42D9F4kTgu/uRhXfe0yvLr/Xtlq1EDtfjpSHnB7qWKe0SxFwNd4LzbUshFftoAxUT3EOlJjyqAvSg9aw2jCChnvqfLMtHJ5q' +
  'GUAd3wtAkcGQVv8/kTag58RCLM0zbLPR9fFxfJMhwH2/NKNbhI9QG3L8J65zyhyTvI3MqbXqcJGL7gOLGP+Tu6K8mfvj+ACn' +
  'iR/dB7qs5Uvn55JgP/2Vf7n05RUgsorPJPu+wx2XBE9l2YVR+fW1Mi2vmCJXoMqUWSNWJibIZNAzUHPD+tcRvwqr1nIIFRb/' +
  'vj+tb/Ob9L/galha7FArlUFbaL/Y6Pei3OTNAkYZNCjYmD1gb6stmP/sf+ZISikwuo+++aM3cC77oHD0VDN1+FBnxev+FkTv' +
  'QkLL1pIXAiCOMUDjc7nq+XCnMj3RDQOhkzyePlzb4952F6ZBxsgByplAS/aYfg2LlUG1vd8W7uxlbx+Vsu3ot1Pj5ZtAzkUO' +
  'cDy30js2mbMCJ6RZcaojKafPdCNYZVvx53xCkpXsY6vJgp9uW34iLK0Q1dfjwZCq0D0RHliU/9wy3FCKfI16wLb5cx3jHz6m' +
  'uCQejVR0Ft9jpJg7m0xs5/++ujSIPq+ByKP1/c606B+Cw0beZ/05tMppR9pOg5ydC/4xbI/DURh+ANri3hkATLVDew6r+fkP' +
  'mqJ/4MC0pcBlxmpcoTKE8E1q33Wbogma/U1HJsVBqeREqGtRg79jVmVFbq2MzaHt/G+9JfCzgTel04PXbd/JAeIJlMQz4kO0' +
  'EJT3QO+07GIPoixbv2ZbVdDMujkoK9xJGDjkgPFD2Hh211LYTaOXPITDK6DARx7Uk15bj1idyPKO8aPnt30PbC4GKJVYlZc7' +
  'MVvqASShn02hq5u2hRsJtxF3YnqdhXHJ5gOGqYKJBwRN6zi3+PD6Zvv6v+bd8/zc4aSjyhNJ6dblH/4l+Ko2wP0snRchSWLR' +
  'MZXHhs6Jsfc9uKPJnnE5r3S0k93wYNxJbKrQuvZhEpCxxNJHyt5jsIemqJ7jazct4mDzZIPU/oUMAf+TaWvGGO7k/QdV6I1C' +
  'JNXMUtBjWnIdDTwORzE3GKd0KdhQu+JmKdAKT02BhcQknYA9UYA0nKG/Yq3B3TqvGiWO4ovGfosW+aqj+MtA5vJ12mCmxaPl' +
  'jQx4EFT0qyFJpQtIoT+vAsbkjjosUOJKDewZFziW9+pwEY2d3qqkD/rknihb1jeGmH4y40fNSz9kQEiyjLhGhHSEpli0xUHp' +
  'KXGibF1QoYg0ZWxw2r9CyJOUb4GHzioq1R1LtIw6qGXWayXqjZDDKAtNWeScOL65Ii/IydzQwAYAIr9Zs9/PdXOT4U2O/mZv' +
  'zp1ejmSfD3V3sg5c2DrHO2j/QJEQ4ra73w7TJKpjw8tUqIpxH2GP2Qif5oCTiVc9+HNkbg8OWopYVhg/sdMhnoEQZCC0s4LB' +
  '9qVMiV4WarAdSGcMplpw';
