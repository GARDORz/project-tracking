// "n x n respond n hr." — resolution time as days x hours, then response time in hours.
export function formatSla(sla: {
  slaResolutionDays: number
  slaResolutionHours: number
  slaResponseHours: number
}): string {
  return `${sla.slaResolutionDays} x ${sla.slaResolutionHours} respond ${sla.slaResponseHours} hr.`
}

export function hasSla(sla: {
  slaResolutionDays: number
  slaResolutionHours: number
  slaResponseHours: number
}): boolean {
  return (
    sla.slaResolutionDays > 0 ||
    sla.slaResolutionHours > 0 ||
    sla.slaResponseHours > 0
  )
}
