async function safeFetch(url, options) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error("JSON parse failed:", text);
      return { error: "Invalid JSON response" };
    }
  } catch {
    return { error: "Network error" };
  }
}
