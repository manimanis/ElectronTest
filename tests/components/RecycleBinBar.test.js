// tests/components/RecycleBinBar.test.js
import { mount } from '@vue/test-utils'
import RecycleBinBar from '../../src/components/RecycleBinBar.vue'

describe('RecycleBinBar.vue', () => {
  function createWrapper(props = {}) {
    return mount(RecycleBinBar, {
      props: {
        recycleBinEmpty: true,
        recycleBinCount: 0,
        actionInProgress: false,
        ...props
      }
    })
  }

  it('shows empty message when recycle bin is empty', () => {
    const wrapper = createWrapper({ recycleBinEmpty: true, recycleBinCount: 0 })
    expect(wrapper.text()).toContain('La corbeille est vide')
  })

  it('shows count when recycle bin has items', () => {
    const wrapper = createWrapper({ recycleBinEmpty: false, recycleBinCount: 5 })
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('éléments')
  })

  it('shows singular for 1 item', () => {
    const wrapper = createWrapper({ recycleBinEmpty: false, recycleBinCount: 1 })
    expect(wrapper.text()).toContain('1 élément')
    expect(wrapper.text()).not.toContain('éléments')
  })

  it('disables button when recycle bin is empty', () => {
    const wrapper = createWrapper({ recycleBinEmpty: true, recycleBinCount: 0 })
    const btn = wrapper.find('.recycle-btn')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('disables button when action is in progress', () => {
    const wrapper = createWrapper({ recycleBinEmpty: false, recycleBinCount: 3, actionInProgress: true })
    const btn = wrapper.find('.recycle-btn')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('enables button when recycle bin has items and no action in progress', () => {
    const wrapper = createWrapper({ recycleBinEmpty: false, recycleBinCount: 3, actionInProgress: false })
    const btn = wrapper.find('.recycle-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('emits empty-recycle-bin when button clicked', async () => {
    const wrapper = createWrapper({ recycleBinEmpty: false, recycleBinCount: 5 })
    const btn = wrapper.find('.recycle-btn')
    await btn.trigger('click')
    expect(wrapper.emitted('empty-recycle-bin')).toBeTruthy()
  })

  it('applies recycle-empty class when empty', () => {
    const wrapper = createWrapper({ recycleBinEmpty: true })
    expect(wrapper.find('.recycle-bin-bar').classes()).toContain('recycle-empty')
  })
})