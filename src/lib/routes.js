// Alamat setiap halaman:
//   /                              daftar project (beranda)
//   /project/baru                  project baru (langkah 1 dalam mode buat)
//   /project/<kode>/data           langkah 1 Data Pelanggan
//   /project/<kode>/peta           langkah 2 Peta & Tagging
//   /project/<kode>/gambar         langkah 3 Gambar Skematik
//   /project/<kode>/rab            langkah 4 Material & RAB
//   /project/<kode>/ekspor         langkah 5 Foto & Ekspor
//   /offline                       Offline & Sinkron
//   /login                         Masuk (mock)
export const STEP_PATHS = ['data', 'peta', 'gambar', 'rab', 'ekspor']

export function parseRoute(pathname = '/') {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/') return { page: 'project' }
  if (p === '/offline') return { page: 'offline' }
  if (p === '/login') return { page: 'login' }
  if (p === '/project/baru') return { page: 'data', opt: 'baru' }
  let m = /^\/project\/([A-Za-z0-9_-]{8,32})\/(data|peta|gambar|rab|ekspor)$/.exec(p)
  if (m) return { page: m[2], kode: m[1] }
  m = /^\/project\/([A-Za-z0-9_-]{8,32})$/.exec(p)
  if (m) return { page: 'data', kode: m[1], redirect: true }
  return { page: 'notfound' }
}

export function pathFor(page, { opt, kode } = {}) {
  if (page === 'project') return '/'
  if (page === 'offline') return '/offline'
  if (page === 'login') return '/login'
  if (page === 'data' && opt === 'baru') return '/project/baru'
  if (STEP_PATHS.includes(page) && kode) return `/project/${kode}/${page}`
  return '/'
}
export const linkProject = (kode) => `${location.origin}/project/${kode}/data`
