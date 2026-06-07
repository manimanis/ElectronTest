// tests/components/TabBar.test.js
import { mount } from '@vue/test-utils'
import TabBar from '../../src/components/TabBar.vue'

describe('TabBar.vue', () => {
  const defaultFolders = [
    { name: 'Desktop', path: 'C:\\Users\\Test\\Desktop', items: [{ path: 'a' }, { path: 'b' }] },
    { name: 'Documents', path: 'C:\\Users\\Test\\Documents', items: [{ path: 'c' }] },
    { name: 'Downloads', path: 'C:\\Users\\Test\\Downloads', items: [] }
  ]

  function createWrapper(props = {}) {
    return mount(TabBar, {
      props: {
        folders: defaultFolders,
        activeTab: 0,
        selectedItems: {},
        getTabSubtitle: () => '',
        getSelectedItemsForFolder: () => [],
        ...props
      }
    })
  }

  it('renders one tab per folder', () => {
    const wrapper = createWrapper()
    const tabs = wrapper.findAll('.tab-btn')
    expect(tabs).toHaveLength(3)
  })

  it('displays folder names', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Desktop')
    expect(wrapper.text()).toContain('Documents')
    expect(wrapper.text()).toContain('Downloads')
  })

  it('shows item counts', () => {
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('0')
  })

  it('highlights the active tab', () => {
    const wrapper = createWrapper({ activeTab: 1 })
    const tabs = wrapper.findAll('.tab-btn')
    expect(tabs[1].classes()).toContain('active')
    expect(tabs[0].classes()).not.toContain('active')
  })

  it('emits update:activeTab when clicked', async () => {
    const wrapper = createWrapper()
    const tabs = wrapper.findAll('.tab-btn')
    await tabs[2].trigger('click')
    expect(wrapper.emitted('update:activeTab')).toBeTruthy()
    expect(wrapper.emitted('update:activeTab')[0]).toEqual([2])
  })

  it('shows selection count when items are selected', () => {
    const selectedItems = {
      'C:\\Users\\Test\\Desktop': new Set(['a'])
    }
    const wrapper = createWrapper({
      selectedItems,
      getSelectedItemsForFolder: (fp) => {
        const set = selectedItems[fp]
        if (!set) return []
        return defaultFolders.find(f => f.path === fp)?.items.filter(i => set.has(i.path)) || []
      }
    })
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('/')
  })

  it('shows subtitle when provided', () => {
    const wrapper = createWrapper({
      getTabSubtitle: (folder) => folder.name === 'Desktop' ? 'C:/.../Desktop' : ''
    })
    expect(wrapper.text()).toContain('C:/.../Desktop')
  })
})