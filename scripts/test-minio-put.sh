#!/bin/bash
set -e
sudo docker exec onenexium-app-1 node <<'NODE'
const { S3Client, ListBucketsCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
(async () => {
  const c = new S3Client({
    region: process.env.MINIO_REGION || "us-east-1",
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY,
      secretAccessKey: process.env.MINIO_SECRET_KEY,
    },
  });
  const b = await c.send(new ListBucketsCommand({}));
  console.log("buckets", (b.Buckets || []).map((x) => x.Name).join(","));
  await c.send(
    new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET,
      Key: "_health/upload-test.txt",
      Body: Buffer.from("ok"),
      ContentType: "text/plain",
    })
  );
  console.log("put_ok");
})().catch((e) => {
  console.error("FAIL", e.name, e.message);
  process.exit(1);
});
NODE
