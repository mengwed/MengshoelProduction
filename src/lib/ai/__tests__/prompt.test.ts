import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../prompt'

describe('buildPrompt', () => {
  it('should include company name in prompt', () => {
    const prompt = buildPrompt({
      company_name: 'TestCo AB',
      organization_type: 'aktiebolag',
      owner_name: 'Test Person',
    })
    expect(prompt).toContain('TestCo AB')
    expect(prompt).toContain('aktiebolag')
    expect(prompt).toContain('Test Person')
    expect(prompt).not.toContain('Mengshoel Production')
  })

  it('should use defaults for missing optional fields', () => {
    const prompt = buildPrompt({
      company_name: 'MinFirma',
      organization_type: 'enskild firma',
      owner_name: null,
    })
    expect(prompt).toContain('MinFirma')
    expect(prompt).toContain('enskild firma')
  })
})
