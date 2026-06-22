---
title: "Annotating and Auditing the Safety Properties of Unsafe Rust"
collection: publications
category: manuscripts
permalink: /publication/2025-annotating-safety-properties
excerpt: 'This paper presents a tag-centric methodology for auditing the consistency and completeness of safety documentation in Rusts unsafe code.'
date: 2025-04-30
venue: 'arXiv'
paperurl: 'https://arxiv.org/abs/2504.21312'
citation: 'Zihao Rao, Hongliang Tian, Xin Wang, and Hui Xu. (2025). "Annotating and Auditing the Safety Properties of Unsafe Rust." <i>arXiv:2504.21312</i>.'
---

We present a tag-centric methodology for auditing the consistency and completeness of safety documentation in Rust's unsafe code. We introduce a domain-specific language to describe safety properties of unsafe APIs, an "unsafety propagation graph" to model unsafe code usage, and a static linter called **safety-tool** that enforces structural consistency between local safety annotations and callee requirements. We applied our approach to the Rust standard library, fixing documentation issues on 27 APIs with 61 safety tags.
