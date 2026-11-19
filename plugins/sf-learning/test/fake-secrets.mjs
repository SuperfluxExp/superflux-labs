// Test-only fake credentials for the redaction tests.
//
// Each value is assembled from short pieces so that public secret scanners,
// which read source files line by line, do not mistake this test code for a
// leaked key. The assembled strings are what the redactor sees at runtime.
// None of them is a real credential; the AWS id is AWS's documented example.
export const AWS_KEY_ID = "AKIA" + "IOSFODNN7EXAMPLE";
export const AWS_KEY_ID_2 = "AKIA" + "IOSFODNN7EXAMPLB";
export const GITHUB_TOKEN = "gh" + "p_" + "0123456789abcdefghij" + "klmnopqrstuvwxyz";
export const ANTHROPIC_KEY = "sk-" + "ant-api03-" + "AbCdEf0123456789" + "AbCdEf0123456789" + "AbCdEf01";
export const ANTHROPIC_KEY_SHORT = "sk-" + "ant-api03-" + "SECRETVALUE" + "0123456789abcdef";
export const OPENAI_KEY = "sk-" + "proj-" + "0123456789abcdefghij" + "klmnopqrstuvwxyzABCD";
export const PRIVATE_KEY_BLOCK = "-----BEGIN RSA " + "PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA " + "PRIVATE KEY-----";
export const BEARER_TOKEN_HEAD = "eyJhbGci" + "OiJIUzI1NiJ9";
export const CONNECTION_PASSWORD = "hunter2" + "supersecret";
export const ASSIGNED_SECRET_VALUE = "zzz9QQQ8vvv7BBB6" + "nnn5MMM4kkk3JJJ2hhh1";
