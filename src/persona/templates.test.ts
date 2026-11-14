import { describe, expect, it } from 'vitest';
import { PERSONA_TEMPLATES, WIZARD_RULE_BLOCKS } from './templates.ts';

describe('内置人设', () => {
  it('可直接使用，且有一致的互动和事实边界', () => {
    for (const { content } of PERSONA_TEMPLATES) {
      expect(content).not.toContain('{{称呼}}');
      expect(content).toContain('尚未结束的互动');
      expect(content).toContain('工具没返回');
    }
    expect(WIZARD_RULE_BLOCKS).toContain('工具没返回');
  });
});
