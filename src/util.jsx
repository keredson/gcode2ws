export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const HTTPS = window.location.protocol=='https:'
 