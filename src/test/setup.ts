import { configureClientDiagnostics } from '@machafoundation/core';

// Diagnostics are still collected, but kept out of test output.
configureClientDiagnostics({ console: false });
