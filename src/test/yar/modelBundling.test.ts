import {expect,it} from 'vitest';
import config from '../../../package.json';
it('retains legacy global model registrations and styles in published bundles',()=>{
 expect(config.sideEffects).toContain('src/yar/services/models/*.js');
 expect(config.sideEffects).toContain('**/*.css');
});