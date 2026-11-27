// Age rules used by the app. The database applies the same rule and has the final say
// (public.confirm_birth_date in supabase/migrations/0008_adults_only.sql).

export const MIN_AGE = 18

// Today's date in India as { y, m, d }, whatever the device's time zone.
export function todayIST() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).split('-').map(Number)
  return { y, m, d }
}

// Whole years between a YYYY-MM-DD birth date and today in India.
// Someone born on 29 February turns a year older on 1 March in non-leap years,
// matching Postgres's "today - interval '18 years'".
export function ageFrom(dob) {
  const [by, bm, bd] = dob.split('-').map(Number)
  const t = todayIST()
  let age = t.y - by
  if (t.m < bm || (t.m === bm && t.d < bd)) age--
  return age
}

export const isAdultDob = (dob) => ageFrom(dob) >= MIN_AGE

// Is it a real calendar date, not in the future and not before 1900?
export function validDob(dob) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false
  const [y, m, d] = dob.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false
  const t = todayIST()
  return y >= 1900 && dob <= `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
}

export const formatDob = (dob) => new Date(dob + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
