export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. Obtener los datos del formulario
    const data = await request.json();

    // 2. Guardar los datos en la base de datos D1
    const stmt = env.DB.prepare(
      "INSERT INTO descargas (nombre, email, sector, app) VALUES (?, ?, ?, ?)"
    ).bind(data.nombre, data.email, data.sector, data.app);
    
    await stmt.run();

    // 3. Buscar el archivo APK en R2 y enviarlo
    // (Asumimos que subiste el archivo 'TransportLog.apk' al bucket 'apks-capsula')
    const apkName = 'TransportLog.apk'; 
    const object = await env.APKS.get(apkName);

    if (!object) {
      return new Response("Archivo no encontrado en el servidor", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Content-Disposition", `attachment; filename="${apkName}"`);

    return new Response(object.body, { headers });

  } catch (error) {
    return new Response("Error interno: " + error.message, { status: 500 });
  }
}
