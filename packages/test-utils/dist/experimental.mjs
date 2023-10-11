import { resolve } from 'pathe';
import { stringifyQuery } from 'ufo';
import { $ as $fetch, u as useTestContext } from './shared/test-utils.8f432eb9.mjs';
import 'execa';
import 'get-port-please';
import 'ofetch';
import '@nuxt/kit';
import 'node:path';
import 'defu';

function $fetchComponent(filepath, props) {
  return $fetch(componentTestUrl(filepath, props));
}
function componentTestUrl(filepath, props) {
  const ctx = useTestContext();
  filepath = resolve(ctx.options.rootDir, filepath);
  const path = stringifyQuery({
    path: filepath,
    props: JSON.stringify(props)
  });
  return `/__nuxt_component_test__/?${path}`;
}

export { $fetchComponent, componentTestUrl };
