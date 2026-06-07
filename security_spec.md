# Security Specification: Attribute-Based Access Control & Zero-Trust Rules

## 1. Data Invariants
1. **Unregistered/Anonymous Manifestation**: Any citizen (anonymous or authenticated) can submit a new manifestation in status `"Pendente"`.
2. **Pre-allocated Status Control**: Citizens cannot transition manifestations directly to other states or modify assigned public agency status.
3. **Public Agent Authority**: Only registered public agents (Admin, Prefeito, Secretaria, Procurador) with validated emails (`email_verified == true`) can update operational fields like `status`, `prioridade`, `despacho`, or assign responsible agents.
4. **PII Protection**: Users' PII such as email logs and user profile configurations are strictly protected from read/write by ordinary citizens or unauthorized third parties. Only the exact user or public agents can access these records.

---

## 2. The "Dirty Dozen" spoofing & injection cases
These 12 scenarios are mathematically denied by our Zero-Trust architecture:

1. **Self-Elevating Admin**: Citizen logs in and attempts to write `/usuarios/malicious@citizen.com` with `perfil: "admin"`. *(REJECTED)*
2. **Status Shortcut**: Citizen tries to submit a new manifestation with status `"Resolvido"`. *(REJECTED)*
3. **Identity Spoofing**: Signed-in user attempts to create a manifestation claiming `autor_nome: "Prefeito"` but auth token email claims otherwise. *(REJECTED)*
4. **Ad Slicing**: Citizen attempts to register a sponsored ad (`/propagandas`) directly bypassing public agent check. *(REJECTED)*
5. **PII Scraping**: Normal user requests all documents in `/usuarios` to extract emails and identities list. *(REJECTED)*
6. **Orphaned Update-Gate**: Intermediary contributor attempts to change the core description of a manifestation post-factum. *(REJECTED)*
7. **Ad-hoc Secretaría Alteration**: Unsigned user issues write command on `/secretarias/Infraestrutura` renaming responsibles. *(REJECTED)*
8. **Junk ID Poisoning**: Cybercriminal attempts to create a document under `/manifestacoes/` with a 1MB string value ID containing exploit characters. *(REJECTED)*
9. **Fake Email Logger**: Malicious user posts spam notifications in `/emails_simulados`. *(REJECTED)*
10. **Admin Bypass without Verified Token**: Rogue user registers Firebase Auth with fake com.gov email, but `email_verified` is false. *(REJECTED)*
11. **Anonymized Post-Action Defacement**: Attacker updates an existing manifestation, modifying the original immutable record fields `createdAt` or `originalOwnerId`. *(REJECTED)*
12. **Recursive Wallet Drain**: Recursive client query on unlimited collections forcing millions of full-document scans. *(REJECTED)*

---

## 3. Recommended Test Configurations (Draft specs)
Tests confirm that all the Dirty Dozen assertions evaluate directly to `PERMISSION_DENIED` since rules require verified tokens and distinct role validations from the verified database.
