import { h } from "vue";
import { isString, isPromise, isArray, isObject } from "@vue/shared";
import destr from "destr";
export const _wrapIf = (component, props, slots) => {
  props = props === true ? {} : props;
  return { default: () => props ? h(component, props, slots) : slots.default?.() };
};
export function createBuffer() {
  let appendable = false;
  const buffer = [];
  return {
    getBuffer() {
      return buffer;
    },
    push(item) {
      const isStringItem = isString(item);
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item;
      } else {
        buffer.push(item);
      }
      appendable = isStringItem;
      if (isPromise(item) || isArray(item) && item.hasAsync) {
        buffer.hasAsync = true;
      }
    }
  };
}
const TRANSLATE_RE = /&(nbsp|amp|quot|lt|gt);/g;
const NUMSTR_RE = /&#(\d+);/gi;
export function decodeHtmlEntities(html) {
  const translateDict = {
    nbsp: " ",
    amp: "&",
    quot: '"',
    lt: "<",
    gt: ">"
  };
  return html.replace(TRANSLATE_RE, function(_, entity) {
    return translateDict[entity];
  }).replace(NUMSTR_RE, function(_, numStr) {
    const num = parseInt(numStr, 10);
    return String.fromCharCode(num);
  });
}
export function vforToArray(source) {
  if (isArray(source)) {
    return source;
  } else if (isString(source)) {
    return source.split("");
  } else if (typeof source === "number") {
    if (import.meta.dev && !Number.isInteger(source)) {
      console.warn(`The v-for range expect an integer value but got ${source}.`);
    }
    const array = [];
    for (let i = 0; i < source; i++) {
      array[i] = i;
    }
    return array;
  } else if (isObject(source)) {
    if (source[Symbol.iterator]) {
      return Array.from(
        source,
        (item) => item
      );
    } else {
      const keys = Object.keys(source);
      const array = new Array(keys.length);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        array[i] = source[key];
      }
      return array;
    }
  }
  return [];
}
export function getFragmentHTML(element, withoutSlots = false) {
  if (element) {
    if (element.nodeName === "#comment" && element.nodeValue === "[") {
      return getFragmentChildren(element, [], withoutSlots);
    }
    if (withoutSlots) {
      const clone = element.cloneNode(true);
      clone.querySelectorAll("[nuxt-ssr-slot-name]").forEach((n) => {
        n.innerHTML = "";
      });
      return [clone.outerHTML];
    }
    return [element.outerHTML];
  }
  return [];
}
function getFragmentChildren(element, blocks = [], withoutSlots = false) {
  if (element && element.nodeName) {
    if (isEndFragment(element)) {
      return blocks;
    } else if (!isStartFragment(element)) {
      const clone = element.cloneNode(true);
      if (withoutSlots) {
        clone.querySelectorAll("[nuxt-ssr-slot-name]").forEach((n) => {
          n.innerHTML = "";
        });
      }
      blocks.push(clone.outerHTML);
    }
    getFragmentChildren(element.nextSibling, blocks, withoutSlots);
  }
  return blocks;
}
function isStartFragment(element) {
  return element.nodeName === "#comment" && element.nodeValue === "[";
}
function isEndFragment(element) {
  return element.nodeName === "#comment" && element.nodeValue === "]";
}
const SLOT_PROPS_RE = /<div[^>]*nuxt-ssr-slot-name="([^"]*)" nuxt-ssr-slot-data="([^"]*)"[^/|>]*>/g;
export function getSlotProps(html) {
  const slotsDivs = html.matchAll(SLOT_PROPS_RE);
  const data = {};
  for (const slot of slotsDivs) {
    const [_, slotName, json] = slot;
    const slotData = destr(decodeHtmlEntities(json));
    data[slotName] = slotData;
  }
  return data;
}
