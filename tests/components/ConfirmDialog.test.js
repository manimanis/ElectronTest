// tests/components/ConfirmDialog.test.js
import { mount } from '@vue/test-utils'
import ConfirmDialog from '../../src/components/ConfirmDialog.vue'

describe('ConfirmDialog.vue', () => {
  function createWrapper(props = {}) {
    return mount(ConfirmDialog, {
      props: {
        visible: false,
        title: 'Test',
        message: 'Test message',
        confirmText: 'Confirmer',
        cancelText: 'Annuler',
        danger: false,
        challenge: null,
        ...props
      },
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: {
            template: '<div><slot /></div>'
          }
        }
      }
    })
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is not visible by default', () => {
    const wrapper = createWrapper({ visible: false })
    expect(document.body.querySelector('.dialog-box')).toBeNull()
  })

  it('is visible when visible prop is true', () => {
    const wrapper = createWrapper({ visible: true })
    expect(document.body.querySelector('.dialog-box')).not.toBeNull()
  })

  it('displays title and message', () => {
    const wrapper = createWrapper({
      visible: true,
      title: 'Test Title',
      message: 'Test Message Content'
    })
    expect(document.body.textContent).toContain('Test Title')
    expect(document.body.textContent).toContain('Test Message Content')
  })

  it('shows danger styling when danger prop is true', () => {
    const wrapper = createWrapper({ visible: true, danger: true })
    const box = document.body.querySelector('.dialog-box')
    expect(box.classList).toContain('dialog-danger')
  })

  it('does not show danger styling when danger is false', () => {
    const wrapper = createWrapper({ visible: true, danger: false })
    const box = document.body.querySelector('.dialog-box')
    expect(box.classList).not.toContain('dialog-danger')
  })

  it('emits cancel when cancel button clicked', async () => {
    const wrapper = createWrapper({ visible: true })
    const cancelBtn = document.body.querySelector('.cancel-btn')
    await cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('emits confirm when confirm button clicked', async () => {
    const wrapper = createWrapper({ visible: true })
    const confirmBtn = document.body.querySelector('.confirm-btn')
    await confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('confirm button is disabled when challenge is not passed', () => {
    createWrapper({
      visible: true,
      challenge: { type: 'word', expected: 'SECRET', question: 'Tapez le mot' }
    })
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(true)
  })

  it('confirm button is enabled when challenge input matches (word type)', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: { type: 'word', expected: 'TEST', question: 'Tapez TEST' }
    })
    const input = document.body.querySelector('.challenge-input')
    input.value = 'TEST'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(false)
  })

  it('confirm button stays disabled when challenge input does not match', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: { type: 'word', expected: 'SECRET', question: 'Tapez SECRET' }
    })
    const input = document.body.querySelector('.challenge-input')
    input.value = 'WRONG'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(true)
  })

  it('shows error hint when challenge input is wrong', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: { type: 'word', expected: 'SECRET', question: 'Tapez SECRET' }
    })
    const input = document.body.querySelector('.challenge-input')
    input.value = 'WRONG'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('Réponse incorrecte')
  })

  it('does not show error hint when challenge input is correct', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: { type: 'word', expected: 'OK', question: 'Tapez OK' }
    })
    const input = document.body.querySelector('.challenge-input')
    input.value = 'OK'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).not.toContain('Réponse incorrecte')
  })

  it('handles number type challenge', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: { type: 'number', expected: 12345, question: 'Tapez le nombre' }
    })
    wrapper.vm.userInput = '12345'
    await wrapper.vm.$nextTick()
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(false)
  })

  it('disables confirm when number challenge is wrong', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: { type: 'number', expected: 12345, question: 'Tapez le nombre' }
    })
    wrapper.vm.userInput = '99999'
    await wrapper.vm.$nextTick()
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(true)
  })

  it('handles choice type challenge', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: {
        type: 'choice',
        expected: 'Oui',
        question: 'Voulez-vous continuer ?',
        options: ['Oui', 'Non', 'Peut-être']
      }
    })
    const buttons = document.body.querySelectorAll('.choice-btn')
    buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(false)
  })

  it('disables confirm when choice challenge is wrong', async () => {
    const wrapper = createWrapper({
      visible: true,
      challenge: {
        type: 'choice',
        expected: 'Oui',
        question: 'Voulez-vous continuer ?',
        options: ['Oui', 'Non', 'Peut-être']
      }
    })
    const buttons = document.body.querySelectorAll('.choice-btn')
    buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    const confirmBtn = document.body.querySelector('.confirm-btn')
    expect(confirmBtn.disabled).toBe(true)
  })

  it('emits cancel when overlay is clicked', async () => {
    const wrapper = createWrapper({ visible: true })
    const overlay = document.body.querySelector('.dialog-overlay')
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('renders with correct button texts', () => {
    const wrapper = createWrapper({
      visible: true,
      confirmText: 'Oui',
      cancelText: 'Non'
    })
    expect(document.body.textContent).toContain('Oui')
    expect(document.body.textContent).toContain('Non')
  })
})