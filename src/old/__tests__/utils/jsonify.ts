export function jsonify<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
