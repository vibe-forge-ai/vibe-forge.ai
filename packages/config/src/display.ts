import { dump } from 'js-yaml'

export const formatConfigValueAsYaml = (value: unknown) => {
  if (value === undefined) {
    return 'null\n'
  }

  return dump(value, {
    noRefs: true,
    lineWidth: 120
  })
}
