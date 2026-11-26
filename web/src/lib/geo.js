export { dist, bearing, deflection } from '@shared/geo.js'
export const fmtRp = (n) => (n == null || n === '' ? '' : Math.round(n).toLocaleString('id-ID'))
