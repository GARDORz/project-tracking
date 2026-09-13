// "ชื่อโปรเจค (2568)" — appends the project's year label in parens when set.
export function formatProjectName(project: {
  name: string
  projectYear: string | null
}): string {
  return project.projectYear
    ? `${project.name} (${project.projectYear})`
    : project.name
}
