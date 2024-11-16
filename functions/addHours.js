export const addHours = (date, hours) => {
  const newDate = new Date(date)
  newDate.setHours(newDate.getHours() + hours)
  return newDate
}
