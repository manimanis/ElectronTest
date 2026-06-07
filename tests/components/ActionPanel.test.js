// tests/components/ActionPanel.test.js
import { mount } from '@vue/test-utils'
import ActionPanel from '../../src/components/ActionPanel.vue'

describe('ActionPanel.vue', () => {
  function createWrapper(props = {}) {
    return mount(ActionPanel, {
      props: {
        totalSelected: 0,
        totalSelectedSize: '0 B',
        currentOperation: '',
        actionInProgress: false,
        sessionStats: { itemsCleaned: 0, spaceFreed: 0, operationCount: 0 },
        ...props
      }
    })
  }

  it('renders selection count', () => {
    const wrapper = createWrapper({ totalSelected: 5, totalSelectedSize: '1.5 MB' })
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('1.5 MB')
  })

  it('shows operation indicator when operation is in progress', () => {
    const wrapper = createWrapper({ currentOperation: 'Suppression en cours...' })
    expect(wrapper.text()).toContain('Suppression en cours...')
    expect(wrapper.find('.operation-indicator').exists()).toBe(true)
  })

  it('hides operation indicator when no operation', () => {
    const wrapper = createWrapper({ currentOperation: '' })
    expect(wrapper.find('.operation-indicator').exists()).toBe(false)
  })

  it('disables action buttons when no selection', () => {
    const wrapper = createWrapper({ totalSelected: 0 })
    const buttons = wrapper.findAll('.action-btn-full')
    buttons.forEach(btn => {
      expect(btn.attributes('disabled')).toBeDefined()
    })
  })

  it('enables action buttons when items are selected', () => {
    const wrapper = createWrapper({ totalSelected: 3 })
    const trashBtn = wrapper.find('.trash-btn')
    expect(trashBtn.attributes('disabled')).toBeUndefined()
  })

  it('disables buttons when action is in progress', () => {
    const wrapper = createWrapper({ totalSelected: 3, actionInProgress: true })
    const trashBtn = wrapper.find('.trash-btn')
    expect(trashBtn.attributes('disabled')).toBeDefined()
  })

  it('emits trash event when trash button clicked', async () => {
    const wrapper = createWrapper({ totalSelected: 2 })
    const trashBtn = wrapper.find('.trash-btn')
    await trashBtn.trigger('click')
    expect(wrapper.emitted('trash')).toBeTruthy()
  })

  it('emits delete event when delete button clicked', async () => {
    const wrapper = createWrapper({ totalSelected: 2 })
    const deleteBtn = wrapper.find('.delete-btn')
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('emits archive-selected event', async () => {
    const wrapper = createWrapper({ totalSelected: 2 })
    const archiveBtn = wrapper.find('.archive-btn')
    await archiveBtn.trigger('click')
    expect(wrapper.emitted('archive-selected')).toBeTruthy()
  })

  it('emits unselect-all event', async () => {
    const wrapper = createWrapper({ totalSelected: 2 })
    const unselectBtn = wrapper.find('.unselect-all-btn')
    await unselectBtn.trigger('click')
    expect(wrapper.emitted('unselect-all')).toBeTruthy()
  })

  it('shows session stats when operations have been performed', () => {
    const wrapper = createWrapper({
      sessionStats: { itemsCleaned: 10, spaceFreed: 52428800, operationCount: 3 }
    })
    expect(wrapper.text()).toContain('Session')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('10')
  })

  it('hides session stats when no operations', () => {
    const wrapper = createWrapper({
      sessionStats: { itemsCleaned: 0, spaceFreed: 0, operationCount: 0 }
    })
    expect(wrapper.find('.session-stats').exists()).toBe(false)
  })
})