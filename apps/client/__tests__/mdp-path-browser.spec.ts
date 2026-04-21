import { describe, expect, it } from 'vitest'

import { buildMdpPathTreeModel } from '#~/components/chat/tools/plugin-mdp/MdpPathBrowser'

describe('mdp path browser', () => {
  it('builds a nested tree model with path metadata for detail rendering', () => {
    const model = buildMdpPathTreeModel([
      {
        connectionKey: 'default',
        clientId: 'client-1',
        rawClientId: 'raw-client-1',
        path: '/navigation/session/open',
        description: 'Open a session page.',
        methods: ['POST'],
        type: 'action'
      },
      {
        connectionKey: 'default',
        clientId: 'client-1',
        rawClientId: 'raw-client-1',
        path: '/navigation/open',
        description: 'Open a page.',
        methods: ['POST'],
        type: 'action'
      }
    ])

    expect(model.nodes.map(node => node.path)).toEqual(['/navigation'])
    expect(model.nodes[0]?.children?.map(node => node.path)).toEqual([
      '/navigation/session',
      '/navigation/open'
    ])

    expect(model.detailsByPath.get('/navigation')).toMatchObject({
      type: 'directory',
      childCount: 2,
      descendantPathCount: 2
    })
    expect(model.detailsByPath.get('/navigation/session/open')).toMatchObject({
      type: 'file',
      description: 'Open a session page.',
      methods: ['POST'],
      pathType: 'action'
    })
  })

  it('merges endpoint metadata into a directory node when the path is both a leaf and a namespace prefix', () => {
    const model = buildMdpPathTreeModel([
      {
        connectionKey: 'default',
        clientId: 'client-1',
        rawClientId: 'raw-client-1',
        path: '/sessions',
        description: 'List sessions.',
        methods: ['GET'],
        type: 'endpoint'
      },
      {
        connectionKey: 'default',
        clientId: 'client-1',
        rawClientId: 'raw-client-1',
        path: '/sessions/:session_id/delete',
        description: 'Delete a session.',
        methods: ['POST'],
        type: 'endpoint'
      }
    ])

    expect(model.nodes.map(node => node.path)).toEqual(['/sessions'])
    expect(model.nodes[0]?.type).toBe('directory')
    expect(model.detailsByPath.get('/sessions')).toMatchObject({
      type: 'directory',
      description: 'List sessions.',
      methods: ['GET'],
      pathType: 'endpoint'
    })
    expect(model.nodes[0]?.children?.map(node => node.path)).toEqual(['/sessions/:session_id'])
  })
})
