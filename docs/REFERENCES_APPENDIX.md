# References and appendices: hand-off for the report build

Prepared by the Chapter 4 agent (session mzazicare-fb) on 17 November 2026 for the Chapter 5 / build agent (mzazicare-40).
Source checked: the current v2 build (140 pages), read from a scratch copy; the .docx was not edited.
Italics are marked with *asterisks*. Paragraph numbers refer to the current v2 build.

**Status: complete.** The user decided on 17 November 2026: remove the 11 uncited entries (1.3), and replace the 13 unverifiable ones with verified sources or reword the sentence (1.4). Section 2 is the final list, with sentence edits R1–R27.

---

## 1. Reference audit

### 1.1 Method

Every in-text citation in Chapters 1 to 6, the AI declaration and the appendices was extracted and matched both ways
against the 63 entries. Entries were then checked against the publisher, DOI registry, ACL Anthology, arXiv,
PubMed or the organisation's own site. 53 distinct citations were found.

### 1.2 Citation with no reference entry (fix needed)

| Chapter | Citation | Finding | Fix |
|---|---|---|---|
| 3 | (Alsentzer et al., 2023) for the FirstAidQA dataset | No entry. FirstAidQA is not by Alsentzer: it is Muna, Salvi, Mushfique and Abrar (2025), arXiv:2511.01289, a NeurIPS 2025 workshop paper. | Change the citation to (Muna et al., 2025) and add the Muna entry in section 2. Note: the built assistant does not use FirstAidQA (it uses the vetted guide in `ml/firstaid/knowledge`), so this Chapter 3 sentence is proposal-stage wording; see section 5. |

### 1.3 Entries that no chapter cites (user decision: keep or remove)

The class notes require every listed entry to be cited. None of these is cited anywhere in the report:

Alhazmi & Huang (2020); Ayeni (2025); Cabrero-Daniel (2023); Mefteh (2022); Mwakio et al. (2024); Naeem et al. (2025);
Shen et al. (2025); Six et al. (2018); Zelalem & Kotecho (2020); Zelalem, Kotecho & Adamek (2020); Zikarge (2017).

Recommendation: remove all eleven. Ayeni and Mwakio are about financial inclusion and do not fit the topic. The other nine
could stay only if a sentence in Chapter 1 or 2 actually draws on them.

### 1.4 Entries that could not be verified (user decision)

No record of these could be found with the given authors, year, title and journal. They may be wrong details of a real
source, or sources that do not exist. They must not stay in the list as they are.

| Entry as listed | Cited in | What was found |
|---|---|---|
| Chan, Campo, Estève & Furaneols (2020), *Sensors*, 20(5), 1358 | Ch 2 | Not found. The same four authors (correct spelling **Fourniols**) wrote "Smart homes — Current features and future perspectives", *Maturitas*, 64(2), 90–97, 2009, https://doi.org/10.1016/j.maturitas.2009.07.014. Likely the intended source. |
| Coe (2017), *Journal of Cross-Cultural Gerontology*, 32(3), 283–299 | Ch 1 | Not found in that journal. Coe, C. (2017). Negotiating eldercare in Akuapem, Ghana: Care-scripts and the role of non-kin. *Africa*, 87(1), 137–154. Likely the intended source. |
| Frontiers (2026), *Frontiers in Digital Health*, 8, Article 104523 | Ch 1 | No such article. "Frontiers" is the publisher, not an author. |
| Hassan (2022), *International Journal of Medical Informatics*, 161, Article 104719 | Ch 2 | Not found. |
| HelpAge International (2021), *Older persons and caregiving challenges in Africa* | Ch 1 | No report with this title. HelpAge's 2021 report on older people in Africa is "Bearing the brunt" (COVID-19 in sub-Saharan Africa). |
| Hoffmann & Donovan (2021), *Information Technologies & International Development*, 17, 33–49 | Ch 1 | Not found. |
| Martinez (2024), *Journal of Software Engineering Research and Development*, 12, Article 4 | Ch 3 | Not found. |
| Mendes, Silva & Rocha (2023), *Healthcare Technology Letters*, 10(1-2), 13–24 | Ch 2, 5 | Not found. |
| Miyachi & Masuda (2017), *Journal of Aging Studies*, 43, 12–21 | Ch 2 | Not found. Kaori Miyachi (alone) studied elderly women's care in Kwale and Kisii counties, Kenya (KAKEN project report, 2017). |
| Nekkalapudi, Rao & Kumar (2025), *IEEE Access*, 13, 14211–14225 | Ch 2, 5 | Not found. |
| Ngo, Tran & Le (2022), *Expert Systems with Applications*, 202, Article 117215 | Ch 2, 5 | Not found. |
| Sanchez (2024), *Journal of Ambient Intelligence and Humanized Computing*, 15(4), 2841–2856 | Ch 2, 5 | Not found. |
| Sandu, Frunza & Unguru (2022), *BRAIN*, 13(2), 312–329 | Ch 3 | Not found. |
| AgeSpace (2024); CarePredict (2024) | Ch 2, 5 | Real services, but the entries have no URL. JubileeTV is verified (https://getjubileetv.com). |

For each unverifiable entry, the user should choose one of three options:
(a) use the verified source named above, where there is one, changing the in-text year where needed;
(b) supply the source they actually read;
(c) remove the citation and reword the sentence so it no longer claims support.

### 1.5 Corrections already made in section 2

| Entry | Correction |
|---|---|
| Mussie et al. (2021) | Article number 491 → **718**; DOI added (https://doi.org/10.1186/s12877-021-02687-9). |
| Okoye & Asa (2011) | The title and journal were wrong. The real article is "Caregiving and stress: Experience of people taking care of elderly relations in south-eastern Nigeria", *Arts and Social Sciences Journal*. The volume and article number still need checking against the PDF. |
| Kingiri & Fu (2019) | DOI added. Published online in 2019; the journal issue is 10(1), 2020. The in-text year 2019 can stay. |
| All verified entries | DOIs or stable URLs added where they exist. |

### 1.6 Notes for the Chapter 5 agent

- If the laughter retraining from 17 November (tone model round 2, `ml/voice/README.md`) is added to Chapter 5, it uses VocalSound. That needs a new entry: Gong, Y., Yu, J., & Glass, J. (2022). Vocalsound: A dataset for improving human vocal sounds recognition. In *ICASSP 2022* (pp. 151–155). IEEE. https://doi.org/10.1109/ICASSP43922.2022.9746828. Check the page numbers before use.
- Para 641 says 204 backend tests. The run on 17 November 2026 passed **208** backend, 34 tone-pipeline and 20 first-aid tests (`docs/testing/automation/results/`). Para 547 says the geofence engine "is covered by 24 unit tests"; `test_presence.py` holds 19 and the shift API and detail files 9 each. Please reconcile both numbers with the version that is submitted.

---

## 2. Final reference list (APA 7, alphabetical, hanging indent)

**Final: the user decided on 17 November 2026.** The 11 uncited entries (1.3) were removed. The 13 unverifiable entries (1.4) were replaced with verified sources, or their sentences reworded (section 3, edits R1–R27). This list replaces the whole current list. It has 52 entries: 63, less 11 uncited and 13 unverifiable, plus 3 corrected (Chan 2009, Coe 2017 in *Identities*, Miyachi & Masuda 2021) and 9 new sources plus Muna et al. 2025 for FirstAidQA.

Notes for the build:
- The "Twenty-first Century Cures Act" entry sorts under T: APA alphabetises a leading number as if it were spelled out.
- There are two Amershi et al. (2019) entries, so they take the suffixes a and b. Edit R26 updates the two existing in-text citations to 2019a.

Abdullah, S., & Mariel, P. (2010). Choice experiment study on the willingness to pay to improve electricity services. *Energy Policy, 38*(8), 4570–4581.

AgeSpace. (2024). *Age Space: Elderly care advice and support for families*. https://www.agespace.org

Akçay, M. B., & Oğuz, K. (2020). Speech emotion recognition: Emotional models, databases, features, preprocessing methods, supporting modalities, and classifiers. *Speech Communication, 116*, 56–76. https://doi.org/10.1016/j.specom.2019.12.001

Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R., & Horvitz, E. (2019a). Guidelines for human-AI interaction. In *Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems* (pp. 1–13). Association for Computing Machinery. https://doi.org/10.1145/3290605.3300233

Amershi, S., Begel, A., Bird, C., DeLine, R., Gall, H., Kamar, E., Nagappan, N., Nushi, B., & Zimmermann, T. (2019b). Software engineering for machine learning: A case study. In *2019 IEEE/ACM 41st International Conference on Software Engineering: Software Engineering in Practice* (pp. 291–300). IEEE. https://doi.org/10.1109/ICSE-SEIP.2019.00042

Ardila, R., Branson, M., Davis, K., Henretty, M., Kohler, M., Meyer, J., Morais, R., Saunders, L., Tyers, F. M., & Weber, G. (2020). Common Voice: A massively-multilingual speech corpus. In *Proceedings of the 12th Language Resources and Evaluation Conference* (pp. 4218–4222). European Language Resources Association. https://aclanthology.org/2020.lrec-1.520

Artola, G., Carrasco, E., Rebescher, K. M., Larburu, N., & Berges, I. (2021). Behavioral anomaly detection system for the wellbeing assessment and lifestyle support of older people at home. *Procedia Computer Science, 192*, 2047–2057. https://doi.org/10.1016/j.procs.2021.08.211

Ben Abacha, A., & Demner-Fushman, D. (2019). A question-entailment approach to question answering. *BMC Bioinformatics, 20*, Article 511. https://doi.org/10.1186/s12859-019-3119-4

Bommasani, R., Hudson, D. A., Adeli, E., Altman, R., Arora, S., von Arx, S., Bernstein, M. S., Bohg, J., Bosselut, A., Brunskill, E., Brynjolfsson, E., Buch, S., Card, D., Castellon, R., Chatterji, N., Chen, A., Creel, K., Davis, J. Q., Demszky, D., . . . Liang, P. (2021). *On the opportunities and risks of foundation models* (arXiv:2108.07258). arXiv. https://doi.org/10.48550/arXiv.2108.07258

Booch, G., Maksimchuk, R. A., Engle, M. W., Young, B. J., Conallen, J., & Houston, K. A. (2007). *Object-oriented analysis and design with applications* (3rd ed.). Addison-Wesley.

Brooke, J. (1996). SUS: A quick and dirty usability scale. In P. W. Jordan, B. Thomas, B. A. Weerdmeester, & I. L. McClelland (Eds.), *Usability evaluation in industry* (pp. 189–194). Taylor & Francis.

Cao, H., Cooper, D. G., Keutmann, M. K., Gur, R. C., Nenkova, A., & Verma, R. (2014). CREMA-D: Crowd-sourced emotional multimodal actors dataset. *IEEE Transactions on Affective Computing, 5*(4), 377–390. https://doi.org/10.1109/TAFFC.2014.2336244

CarePredict. (2024). *CarePredict: AI-powered senior care platform*. https://www.carepredict.com

Chan, M., Campo, E., Estève, D., & Fourniols, J.-Y. (2009). Smart homes — Current features and future perspectives. *Maturitas, 64*(2), 90–97. https://doi.org/10.1016/j.maturitas.2009.07.014

Chawla, N. V., Bowyer, K. W., Hall, L. O., & Kegelmeyer, W. P. (2002). SMOTE: Synthetic minority over-sampling technique. *Journal of Artificial Intelligence Research, 16*, 321–357. https://doi.org/10.1613/jair.953

Coe, C. (2017). Transnational migration and the commodification of eldercare in urban Ghana. *Identities: Global Studies in Culture and Power, 24*(5), 542–556. https://doi.org/10.1080/1070289X.2017.1346510

Davis, S., & Mermelstein, P. (1980). Comparison of parametric representations for monosyllabic word recognition in continuously spoken sentences. *IEEE Transactions on Acoustics, Speech, and Signal Processing, 28*(4), 357–366. https://doi.org/10.1109/TASSP.1980.1163420

Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K. (2019). BERT: Pre-training of deep bidirectional transformers for language understanding. In *Proceedings of the 2019 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies* (pp. 4171–4186). Association for Computational Linguistics. https://doi.org/10.18653/v1/N19-1423

FitzGerald, J., Hench, C., Peris, C., Mackie, S., Rottmann, K., Sanchez, A., Nash, A., Urbach, L., Kakarala, V., Singh, R., Ranganath, S., Crist, L., Britan, M., Leeuwis, W., Tur, G., & Natarajan, P. (2023). MASSIVE: A 1M-example multilingual natural language understanding dataset with 51 typologically-diverse languages. In *Proceedings of the 61st Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)* (pp. 4277–4302). Association for Computational Linguistics. https://doi.org/10.18653/v1/2023.acl-long.235

García, S., Luengo, J., & Herrera, F. (2015). *Data preprocessing in data mining*. Springer. https://doi.org/10.1007/978-3-319-10247-4

Géron, A. (2019). *Hands-on machine learning with Scikit-Learn, Keras, and TensorFlow* (2nd ed.). O’Reilly Media.

GSMA. (2023). *The mobile economy Sub-Saharan Africa 2023*. https://www.gsma.com/mobileeconomy/wp-content/uploads/2023/10/20231017-GSMA-Mobile-Economy-Sub-Saharan-Africa-report.pdf

Guo, C., Pleiss, G., Sun, Y., & Weinberger, K. Q. (2017). On calibration of modern neural networks. In *Proceedings of the 34th International Conference on Machine Learning* (Vol. 70, pp. 1321–1330). PMLR. https://proceedings.mlr.press/v70/guo17a.html

International Federation of Red Cross and Red Crescent Societies. (2020). *International first aid, resuscitation, and education guidelines 2020*. https://www.ifrc.org/document/international-first-aid-resuscitation-and-education-guidelines

ISO/IEC/IEEE. (2022). *Software and systems engineering — Software testing — Part 1: General concepts* (ISO/IEC/IEEE Standard No. 29119-1:2022). International Organization for Standardization. https://www.iso.org/standard/81291.html

JubileeTV. (2024). *JubileeTV: Family connection and remote care through the television*. https://getjubileetv.com

Kingiri, A. N., & Fu, X. (2019). Understanding the diffusion and adoption of digital finance innovation in emerging economies: M-Pesa money mobile transfer service in Kenya. *Innovation and Development, 10*(1), 67–87. https://doi.org/10.1080/2157930X.2019.1570695

Kohavi, R. (1995). A study of cross-validation and bootstrap for accuracy estimation and model selection. In *Proceedings of the 14th International Joint Conference on Artificial Intelligence* (Vol. 2, pp. 1137–1143). Morgan Kaufmann.

Larson, S., Mahendran, A., Peper, J. J., Clarke, C., Lee, A., Hill, P., Kummerfeld, J. K., Leach, K., Laurenzano, M. A., Tang, L., & Mars, J. (2019). An evaluation dataset for intent classification and out-of-scope prediction. In *Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing and the 9th International Joint Conference on Natural Language Processing* (pp. 1311–1316). Association for Computational Linguistics. https://doi.org/10.18653/v1/D19-1131

LeCun, Y., Bengio, Y., & Hinton, G. (2015). Deep learning. *Nature, 521*(7553), 436–444. https://doi.org/10.1038/nature14539

Livingstone, S. R., & Russo, F. A. (2018). The Ryerson Audio-Visual Database of Emotional Speech and Song (RAVDESS): A dynamic, multimodal set of facial and vocal expressions in North American English. *PLoS ONE, 13*(5), Article e0196391. https://doi.org/10.1371/journal.pone.0196391

Miyachi, K., & Masuda, K. (2021). A preparatory study of care for elderly women in rural Kenya. *Arxiu d’Etnografia de Catalunya, 22*, 127–146. https://doi.org/10.17345/aec22.127-146

Mnih, V., Kavukcuoglu, K., Silver, D., Rusu, A. A., Veness, J., Bellemare, M. G., Graves, A., Riedmiller, M., Fidjeland, A. K., Ostrovski, G., Petersen, S., Beattie, C., Sadik, A., Antonoglou, I., King, H., Kumaran, D., Wierstra, D., Legg, S., & Hassabis, D. (2015). Human-level control through deep reinforcement learning. *Nature, 518*(7540), 529–533. https://doi.org/10.1038/nature14236

Muna, S. S., Salvi, R. I., Mushfique, M. R., & Abrar, A. (2025). *FirstAidQA: A synthetic dataset for first aid and emergency response in low-connectivity settings* (arXiv:2511.01289). arXiv. https://doi.org/10.48550/arXiv.2511.01289

Mussie, K. M., Pageau, F., Merkt, H., Wangmo, T., & Elger, B. S. (2021). Challenges in providing ethically competent health care to incarcerated older adults with mental illness: A qualitative study exploring mental health professionals’ perspectives in Canada. *BMC Geriatrics, 21*, Article 718. https://doi.org/10.1186/s12877-021-02687-9

Okoye, U. O., & Asa, S. S. (2011). Caregiving and stress: Experience of people taking care of elderly relations in south-eastern Nigeria. *Arts and Social Sciences Journal*. [volume and article number to confirm from the PDF]

OWASP Foundation. (2020). *OWASP web security testing guide* (Version 4.2). https://owasp.org/www-project-web-security-testing-guide/v42/

Panayotov, V., Chen, G., Povey, D., & Khudanpur, S. (2015). Librispeech: An ASR corpus based on public domain audio books. In *2015 IEEE International Conference on Acoustics, Speech and Signal Processing* (pp. 5206–5210). IEEE. https://doi.org/10.1109/ICASSP.2015.7178964

Piczak, K. J. (2015). ESC: Dataset for environmental sound classification. In *Proceedings of the 23rd ACM International Conference on Multimedia* (pp. 1015–1018). Association for Computing Machinery. https://doi.org/10.1145/2733373.2806390

Powers, D. M. W. (2011). Evaluation: From precision, recall and F-measure to ROC, informedness, markedness and correlation. *Journal of Machine Learning Technologies, 2*(1), 37–63. https://arxiv.org/abs/2010.16061

Rashidi, P., & Mihailidis, A. (2013). A survey on ambient-assisted living tools for older adults. *IEEE Journal of Biomedical and Health Informatics, 17*(3), 579–590. https://doi.org/10.1109/JBHI.2012.2234129

Republic of Kenya. (2019). *The Data Protection Act, No. 24 of 2019*. Kenya Gazette Supplement No. 181. Government Printer. http://kenyalaw.org/kl/fileadmin/pdfdownloads/Acts/2019/TheDataProtectionAct__No24of2019.pdf

Schwaber, K., & Sutherland, J. (2020). *The Scrum guide: The definitive guide to Scrum: The rules of the game*. Scrum.org. https://scrumguides.org/scrum-guide.html

Sculley, D., Holt, G., Golovin, D., Davydov, E., Phillips, T., Ebner, D., Chaudhary, V., Young, M., Crespo, J.-F., & Dennison, D. (2015). Hidden technical debt in machine learning systems. In *Advances in Neural Information Processing Systems 28* (pp. 2503–2511). Curran Associates. https://proceedings.neurips.cc/paper/2015/file/86df7dcfd896fcaf2674f757a2463eba-Paper.pdf

Settles, B. (2012). *Active learning*. Morgan & Claypool. https://doi.org/10.2200/S00429ED1V01Y201207AIM018

Suri, T., & Jack, W. (2016). The long-run poverty and gender impacts of mobile money. *Science, 354*(6317), 1288–1292. https://doi.org/10.1126/science.aah5309

Sutton, R. S., & Barto, A. G. (2018). *Reinforcement learning: An introduction* (2nd ed.). MIT Press. http://incompleteideas.net/book/the-book-2nd.html

21st Century Cures Act, Pub. L. No. 114-255, 130 Stat. 1033 (2016). https://www.congress.gov/114/plaws/publ255/PLAW-114publ255.pdf  ⟨sort under "Twenty-first"⟩

Wang, L., Yang, N., Huang, X., Yang, L., Majumder, R., & Wei, F. (2024). *Multilingual E5 text embeddings: A technical report* (arXiv:2402.05672). arXiv. https://doi.org/10.48550/arXiv.2402.05672

Welch, G., & Bishop, G. (2006). *An introduction to the Kalman filter* (Technical Report TR 95-041). University of North Carolina at Chapel Hill. https://www.cs.unc.edu/~welch/media/pdf/kalman_intro.pdf

Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. *Journal of the American Statistical Association, 22*(158), 209–212. https://doi.org/10.1080/01621459.1927.10502953

Zamir, S., Hennessy, C. H., Taylor, A. H., & Jones, R. B. (2018). Video-calls to reduce loneliness and social isolation within care environments for older people: An implementation study using collaborative action research. *BMC Geriatrics, 18*, Article 62. https://doi.org/10.1186/s12877-018-0746-y

### 2.1 Sentence edits for the replaced sources (exact before and after)

Paragraph numbers are from the current v2 build. Only the citation and, where needed, the claim change; everything else in each paragraph stays.

| # | Ch / para | Before | After |
|---|---|---|---|
| R1 | 1 / 156 | `…has created a significant care deficit (Coe, 2017).` | unchanged (Coe, 2017 is now the verified *Identities* article on migrant children and eldercare in Ghana) |
| R2 | 1 / 157 | `This visibility gap leaves vulnerable elderly individuals exposed to potential neglect and leaves remote families in a state of constant psychological distress regarding the safety of their loved ones (Coe, 2017).` | `This visibility gap leaves vulnerable elderly individuals exposed to potential neglect and leaves migrant children anxious about the care their parents receive (Coe, 2017).` |
| R3 | 1 / 157 | `Families typically source caregivers through word-of-mouth referrals or informal social media groups, which lack any rigorous vetting or background verification processes (HelpAge International, 2021).` | `Families typically find caregivers through word-of-mouth referrals or informal social media groups, which offer no formal vetting or background checks.` |
| R4 | 1 / 158 | `…its application in the elder-care sector remains limited to basic communication rather than accountability and safety (Hoffmann & Donovan, 2021).` | `…its application in the elder-care sector remains limited to basic communication rather than accountability and safety (GSMA, 2023).` *(GSMA supports the penetration half; keep the clause "While mobile technology has seen high penetration in the region" before it.)* |
| R5 | 1 / 162 | `Research indicates that this lack of technological monitoring directly correlates with delayed emergency responses and increased social isolation, as remote family members have no objective way to confirm if a caregiver arrived on time or stayed for the required duration (Frontiers, 2026).` | `Without such monitoring, remote family members have no objective way to confirm whether a caregiver arrived on time or stayed for the required duration.` |
| R6 | 1 / 162 | `…all of which are easily manipulated and lack physical proof of presence (Coe, 2017).` | `…all of which are easily manipulated and lack physical proof of presence.` |
| R7 | 1 / 163 | `Despite the wide presence of mobile money platforms like M-Pesa, which facilitate billions in healthcare-related transactions, there is no corresponding digital system to guarantee that these funds result in actual service delivery (Hoffmann & Donovan, 2021).` | `Despite the wide use of mobile money platforms such as M-Pesa (Suri & Jack, 2016), there is no corresponding digital system to guarantee that the money families send results in actual service delivery.` |
| R8 | 1 / 183 | `…with platforms like M-Pesa revolutionizing how families manage healthcare remittances (Hoffmann & Donovan, 2021).` | `…with platforms like M-Pesa changing how families send money (Kingiri & Fu, 2019; Suri & Jack, 2016).` *(Remove "healthcare accessibility and" earlier in the same sentence: no verified source supports it.)* |
| R9 | 1 / 183 | `…demonstrating that both caregivers and families in the region possess the digital literacy required to engage with mobile-first platforms (HelpAge International, 2021).` | `…and mobile phone use is now widespread in the region, so caregivers and families can be expected to engage with mobile-first platforms (GSMA, 2023).` |
| R10 | 1 / 184 | `…leaving a void in caregiver accountability and exposing a lack of verification in the sector (Coe, 2017).` | `…leaving a void in caregiver accountability and exposing a lack of verification in the sector.` |
| R11 | 2 / 209 | `As noted by Mendes et al. (2023), conversational agents and AI-driven monitoring are demonstrating a significant impact on the emotional and physical well-being of elders in AAL environments.` | `As the survey by Rashidi and Mihailidis (2013) shows, ambient-assisted living tools, including AI-driven monitoring, are being developed to support the safety, independence and well-being of older adults at home.` |
| R12 | 2 / 211 | `…informal home-care relies on manual logbooks, which are susceptible to data security breaches and performance failures (Hassan, 2022).` | `…informal home-care relies on manual logbooks, or on none at all, which cannot be checked independently.` |
| R13 | 2 / 212 | `Ethnographic studies in rural and urban Kenya by Miyachi and Masuda (2017) indicate that as social structures shift toward nuclear family units, elderly individuals, particularly women, are increasingly left in the care of untrained relatives or informal workers who operate without supervision.` | `An ethnographic study of older women in Kwale County by Miyachi and Masuda (2021) describes how changing family structures leave older women in rural Kenya increasingly dependent on relatives and neighbours, most of whom have no training in care.` *(User: confirm this matches what you remember of the study; the article is open access at the DOI.)* |
| R14 | 2 / 214 | `Nekkalapudi et al. (2025) argue that for high-stakes task management, simple GPS tracking is insufficient because it lacks the necessary precision and context for medical accountability.` | `In the United States, the 21st Century Cures Act (2016) requires Medicaid-funded personal care and home health visits to be verified electronically, which shows that a simple attendance record is not considered enough for accountability in home care.` |
| R15 | 2 / 218 | `Sanchez (2024) demonstrates that home-based systems can establish a Behavioral Baseline by analyzing historical data on caregiver visit durations and task acknowledgments.` | `Artola et al. (2021) show that a home monitoring system can learn a person's usual behaviour and flag deviations from it; the same idea could be applied to caregiver visit durations and task acknowledgments.` |
| R16 | 2 / 219 | `…providing a non-invasive emotional safety net that respects the privacy constraints of the home environment (Mendes et al., 2023; Ngo et al., 2022).` | `…providing a non-invasive emotional safety net that respects the privacy constraints of the home environment (Akçay & Oğuz, 2020).` |
| R17 | 2 / 229 | `Additionally, the automated video call feature works well to reduce loneliness and simplifies daily check-ins for long-distance family members (Mendes et al., 2023).` | `Additionally, the video call feature simplifies daily check-ins for long-distance family members, an approach that has been used to reduce loneliness among older people (Zamir et al., 2018).` |
| R18 | 2 / 229 | `…making it highly vulnerable to the frequent power outages and internet drops common in Kenyan urban areas (Hassan, 2022).` | `…making it vulnerable to the power outages that Kenyan households experience (Abdullah & Mariel, 2010) and to interruptions of the home internet connection.` |
| R19 | 2 / 232 | `…and it offers non-invasive fall detection without requiring the user to do anything (Chan et al., 2020).` | `…and it offers non-invasive fall detection without requiring the user to do anything (CarePredict, 2024; Chan et al., 2009).` |
| R20 | 2 / 235 | `It offers a highly cost-effective alternative to continuous in-person care and provides immediate environmental risk protection for the household (Sanchez, 2024).` | `It offers a lower-cost alternative to continuous in-person care and some protection against risks in the home (AgeSpace, 2024).` |
| R21 | 2 / 235 | `…cannot provide tamper-proof evidence that a hired caregiver is actually fulfilling their contractual obligations at the house (Nekkalapudi et al., 2025).` | `…cannot provide tamper-proof evidence that a hired caregiver is actually fulfilling their contractual obligations at the house.` |
| R22 | 3 / 281 | `…continuously refined through disciplined execution loops (Sandu et al., 2022).` | `…continuously refined through disciplined execution loops (Amershi et al., 2019b).` |
| R23 | 3 / 282 | `…to resolve information asymmetry for diaspora sponsors (Martinez, 2024).` | `…to resolve information asymmetry for diaspora sponsors (Amershi et al., 2019b).` |
| R24 | 5 / 692 | `Nekkalapudi et al. (2025) argue that simple GPS tracking is not enough for accountability and that a check-in must be tied to the location of the patient.` | `Electronic visit verification under the 21st Century Cures Act (2016) likewise treats a simple attendance record as insufficient for home care and verifies each visit electronically.` |
| R25 | 5 / 693 | `The tone model supports the view of Mendes et al. (2023) and Ngo et al. (2022) that acoustic cues can provide a non-invasive safety net.` | `The tone model supports the view, summarised by Akçay and Oğuz (2020), that emotion can be recognised from acoustic cues alone, which makes a non-invasive safety net possible.` |
| R26 | 3 / 279 and 5 / 886 | `Amershi et al., 2019)` and `Amershi et al. (2019)` | `Amershi et al., 2019a)` and `Amershi et al. (2019a)` |
| R27 | 5 / 695 | `The behavioural anomaly detection proposed in Chapter 1, following Sanchez (2024), was not built.` | `The behavioural anomaly detection proposed in Chapter 1, following the approach of Artola et al. (2021), was not built.` |

Also T1 (section 3): `(Alsentzer et al., 2023)` → `(Muna et al., 2025)`.

**For the user to check (not changed):**
- Chapter 2 (para 234) describes AgeSpace as an "ambient monitoring service" that watches kettle and microwave use. agespace.org is a UK advice and support hub that lists monitoring products; it is not itself a monitoring system. If the description came from a specific monitoring product, name that product instead.
- Abdullah and Mariel (2010) has no DOI in the records found; add it from ScienceDirect if available. Okoye and Asa (2011) needs its volume number.

---

## 3. In-text citation and cross-reference edits (exact before and after)

| # | Chapter / para | Before | After |
|---|---|---|---|
| T1 | Ch 3 (FirstAidQA sentence) | `(Alsentzer et al., 2023)` | `(Muna et al., 2025)` |
| T2 | Ch 3, para 301 | `Each sprint runs for three weeks, during which the selected tasks are programmed and verified.` | `Each sprint runs for three weeks, during which the selected tasks are programmed and verified. The original schedule and the progress actually made are compared in Appendix A.` |
| T3 | Ch 5, para 489 | `…because the accounts, shifts and dashboards had to exist before any model could be connected to them.` | `…because the accounts, shifts and dashboards had to exist before any model could be connected to them. Appendix A compares the planned schedule with the dates recorded in the development log.` |
| T4 | Ch 5, para 512 | `…including cases for jitter at the edge, breaks, shifts that cross midnight, fake GPS and inaccurate fixes.` | `…including cases for jitter at the edge, breaks, shifts that cross midnight, fake GPS and inaccurate fixes. The core of the rule is reproduced in Listing B.1 in Appendix B.` |
| T5 | Ch 5 (two-step sign-in paragraph) | `These rules are covered by 40 automated tests in the accounts application.` | `These rules are covered by 40 automated tests in the accounts application, and the check of the code is shown in Listing B.3 in Appendix B.` |
| T6 | Ch 5, para 519 | `The checklist rules are covered by 30 automated tests.` | `The checklist rules are covered by 30 automated tests, and Listing B.4 in Appendix B shows how a tick is refused outside the geofence.` |
| T7 | Ch 5 (tone alert paragraph) | `…have an angry probability of 60% or more, and at most once in half an hour.` | `…have an angry probability of 60% or more, and at most once in half an hour. Listing B.2 in Appendix B shows this rule in the code.` |
| T8 | Ch 5, para 641 | `Table 5.14 summarises the main test cases and their traceability to the requirements.` | `Table 5.14 summarises the main test cases and their traceability to the requirements, and Appendix C maps each automated test file to these cases and holds the supporting evaluation records.` |
| T9 | AI declaration, para 740 (last sentence) | `…and takes full responsibility for the submitted work.` | `…and takes full responsibility for the submitted work. The similarity report for the submitted version is given in Appendix D.` |

The order of first mention is then A (Chapter 3), B (Chapter 5), C (Chapter 5) and D (declaration), which matches the appendix letters.

---

## 4. Appendices

Replace the current "Appendix" section. Its headings carry stray drawing-anchor digits, and "Appendix 1/2" should become lettered appendices.
The main heading "Appendices" is unnumbered, like References. Each appendix is a Heading 2, starts on a new page and appears in the table of contents.
Appendix figures and tables are numbered A.1, B.1 and so on.

### Appendix A: Project Schedule and Gantt Chart

Text:
> Figure A.1 reproduces the schedule approved with the proposal. Figure A.2 compares the planned implementation sprints with the work actually done, using the dates in the development log and the commit history of the repository. Development began on 12 October 2026, one week after the planned start, and the order of the work changed. The accounts, the geofence, the screens for the three roles and the tone model were built first, because every model depended on them. The first-aid assistant, planned as Sprint 1, was built last, from 9 to 16 November. The DQN geofence agent planned for Sprint 2 was replaced by a rule-based engine, completed by 26 October (Table 5.12). Several features not in the plan were added during development: photographic task proof, the two-step sign-in, Google sign-in, push notifications and the web dashboard. Testing ran with every change from 22 October instead of in one block at the end. The grey band marks 17 November 2026, the date of this record.

- Figure A.1 Original project schedule (proposal): `docs/diagrams/appendix/figA_1_original_plan.png`
  - A clean redraw of the current Appendix 1 image, without its "[cite: …]" legend artefacts. The final defence is placed on 24 December, where the original bar sits. The original table listed it as "23/11/26–01/12/26", which contradicts its own chart, so the user should confirm the date.
- Figure A.2 Planned and actual progress of the implementation: `docs/diagrams/appendix/figA_2_plan_vs_actual.png`
  - White bars show the plan; dark bars show the actual work.

### Appendix B: Selected Code and Implementation Details

Text:
> The full source code is available at https://github.com/alvviinn/Mzazicare. The extracts below come from commit `[INSERT FINAL COMMIT HASH]` and explain the decisions discussed in Chapter 5. Short extracts are reproduced without change; comments in the code are the author's own. No code was adapted from other projects. The libraries used keep their own licences (Django and Django REST Framework: BSD; React Native, Expo, Next.js and ONNX Runtime: MIT; PyTorch: BSD-style; the multilingual-e5-small model: MIT). The training datasets are used under their licences: RAVDESS (CC BY-NC-SA 4.0), CREMA-D (ODbL), LibriSpeech (CC BY 4.0), ESC-50 (CC BY-NC 3.0) and VocalSound (CC BY-SA 4.0). No credentials or personal data appear in the extracts.

Listings (monospace, 9 pt, each with a caption above it). The code is copied verbatim from the files at the time of writing; refresh it if the files change before submission:

- **Listing B.1 Geofence presence rule** (`backend/care/presence.py`, constants and `evaluate()`): see section 6.1
- **Listing B.2 Tone shares and the angry-voices rule** (`ml/voice/infer.py`, `ToneAnalyzer.analyze()`): see section 6.2
- **Listing B.3 Checking the emailed sign-in code** (`backend/accounts/two_factor.py`, `verify()`): see section 6.3
- **Listing B.4 Ticking a task off with a photograph inside the geofence** (`backend/care/caretaker_views.py`, `require_in_range()` and `TaskDoneView.post()`): see section 6.4

### Appendix C: Supporting Instruments and Evaluation Evidence

Text:
> Table C.1 links each automated test file to the test cases in Table 5.14. The tests were run on 17 November 2026; all passed, and the logs are kept in the repository under `docs/testing/automation/results/`. Section C.2 lists the instruments used for the emulated field test and the simulated usability test. Their results are reported in Chapter 5.

**Table C.1 Automated test files, their size and the test cases they support**

| Test file | Tests | Test cases (Table 5.14) | What it checks |
|---|---|---|---|
| `backend/accounts/tests/test_auth_and_roles.py` | 13 | TC-001, TC-002 | Registration, sign-in, roles, linking by email |
| `backend/accounts/tests/test_two_factor_and_google.py` | 19 | TC-003 | Emailed code, attempts, expiry, Google sign-in |
| `backend/accounts/tests/test_azure_email.py` | 8 | TC-003 | Sending the code through Azure Communication Services |
| `backend/care/tests/test_presence.py` | 19 | TC-004, TC-005, TC-006 | Geofence with a controlled clock: entry, exit, jitter, breaks, midnight, mock and inaccurate fixes |
| `backend/care/tests/test_shift_api.py` | 9 | TC-006 | Shift state, refused manual start, ending a shift |
| `backend/care/tests/test_shift_detail.py` | 9 | TC-006, FR-09 | Day shift timeline, breaks, access |
| `backend/care/tests/test_tasks.py` | 30 | TC-007 | Task lists, assignment, photo proof, geofence check, history |
| `backend/care/tests/test_audio_capture.py` | 13 | TC-008 | Consent of each person, recording only during a verified shift |
| `backend/care/tests/test_tone_endpoint.py` | 9 | TC-009, TC-010 | Audio endpoint: bad input, in-memory analysis, distress alert |
| `backend/care/tests/test_tone_live.py` | 7 | FR-04, FR-06 | Live tone view for the family |
| `backend/care/tests/test_alerts_and_map.py` | 7 | TC-011 | Alert evidence, severity order, shift map |
| `backend/care/tests/test_chat_and_dashboard.py` | 16 | TC-011, TC-012 | Dashboard and private chats |
| `backend/care/tests/test_circle.py` | 13 | TC-012, TC-013 | Care circle contacts and the "I need help" emergency |
| `backend/care/tests/test_elder.py` | 11 | TC-013 | Elderly home, mood check-in, medicines |
| `backend/care/tests/test_firstaid.py` | 11 | TC-014, TC-015, TC-023, TC-024 | First-aid endpoint, danger handling, follow-up |
| `backend/care/tests/test_push.py` | 14 | FR-06 | Push notifications for alerts and messages |
| `ml/voice/tests/` (3 files) | 34 | TC-016, TC-017 | Features, data split by speaker, inference, model comparison |
| `ml/firstaid/tests/` (3 files) | 20 | TC-025 | Guide completeness, word list, safety policy |
| **Total** | **262** | | Backend 208, machine learning 54 |

**C.2 Instruments for TC-019 and TC-021.** To come from the testing agent (`docs/testing/`, delivered through `docs/testing/REPORT_INSERTS.md`). It covers:
- the emulated field-test script (routes and timings);
- the task list for each role;
- the eight simulated personas;
- the ten-item System Usability Scale (Brooke, 1996) with its scoring.

Placeholder until then: `[INSERT FIELD TEST SCRIPT, USABILITY TASKS, PERSONAS AND SUS FORM FROM docs/testing]`. Keep the wording "emulated" and "simulated" as the testing agent requires.

### Appendix D: Plagiarism/Turnitin Report

Text: none beyond the heading.

- Placeholder: `[INSERT THE TURNITIN SIMILARITY REPORT FOR THE FINAL SUBMITTED VERSION]`.
- The current Appendix 2 image cannot stay. It is page 2 of a **48-page** submission (13% similarity, submission ID trn:oid:::2945:392914268), so it belongs to an earlier draft, not the 140-page final report. The user must obtain the report for the final version through the supervisor or the submission system.

---

## 5. Before supervisor review: items found

- **Proposal-stage wording in Chapter 3.** Para 301 still describes four future sprints (mBERT chatbot on FirstAidQA, DQN geofence agent with a 30-metre radius) in the present tense. The class notes ask for completed work in the past tense. Suggested approach (user's call): keep Chapter 3 as the approved method, but add a sentence that the executed order and changes are in Section 5.3, Table 5.12 and Appendix A (T2 does this).
- **Same version everywhere.** The report, repository, deployment and demonstration must describe one version. The test counts (204 vs 208) and the 24 geofence tests should be updated from the final run. The commit hash for Appendix B should be set once the final commit is pushed (28 files are uncommitted at present).
- **Placeholders still in Chapter 5** (for example TC-018 measured times, TC-021 SUS, TC-022 CI run, the supervisor approval date in Table 5.12) must be filled before submission.

---

## 6. Code listings for Appendix B

### 6.1 Listing B.1 Geofence presence rule (backend/care/presence.py, lines 23-29 and 198-253)

```python
ENTER_RADIUS_M = 15  # within this distance the caretaker is verified as present
EXIT_RADIUS_M = 20  # once inside, the caretaker only counts as gone beyond this (stops GPS jitter flapping the timer)
FRESH_S = 120  # a location older than this is ignored
MAX_ACCURACY_M = 40  # fixes less accurate than this can't be trusted for a 15 m check
STALE_PAUSE_S = 180  # no usable fix for this long -> a break starts at the last time they were seen in range
MERGE_GAP_S = 120  # coming back within this long of leaving is GPS noise, not a break: no new segment
AWAY_AFTER_MIN = 90  # on a break this long the screens say "away" (it is still the same shift)

...

def evaluate(caretaker, now=None):
    """Bring this caretaker's shift for today in line with the latest locations. Safe to call at any time."""
    now = now or timezone.now()
    caretaker = User.objects.select_for_update().get(pk=caretaker.pk)
    if caretaker.role != Role.CARETAKER or not caretaker.sponsor_id:
        return None

    carry = _close_previous_days(caretaker, now)
    cloc = Location.objects.filter(user=caretaker).first()
    shifts = todays_shifts(caretaker, now)

    # 1. A shift is being counted right now: keep going, or start a break.
    for s in shifts:
        seg = open_segment(s)
        if seg:
            state, _ = measure(cloc, Location.objects.filter(user=s.elderly).first(), now, EXIT_RADIUS_M)
            if state == 'in':
                s.last_in_range_at = now
                s.save(update_fields=['last_in_range_at'])
            else:
                gone = state == 'out'
                stale = state == 'unknown' and (now - (s.last_in_range_at or seg.start)).total_seconds() > STALE_PAUSE_S
                if gone or stale:
                    seg.end = max(s.last_in_range_at or now, seg.start)  # the break began when last seen in range
                    seg.save(update_fields=['end'])
            return current_shift(caretaker, now)

    # 2. Not counting. Is the caretaker now near an elderly person?
    elders = list(User.objects.filter(sponsor_id=caretaker.sponsor_id, role=Role.ELDERLY))
    readings = [(e, *measure(cloc, Location.objects.filter(user=e).first(), now, ENTER_RADIUS_M)) for e in elders]
    near = sorted((d, e.pk, e) for e, s, d in readings if s == 'in')
    if near:
        elder = near[0][2]
        start_at = carry[1] if carry and carry[0].pk == elder.pk else now  # carry on from midnight if they never left
        shift = next((s for s in shifts if s.elderly_id == elder.pk), None)
        if shift is None:
            shift = Shift.objects.create(
                caretaker=caretaker, elderly=elder, start_time=start_at, source='auto', last_in_range_at=start_at
            )
            ShiftSegment.objects.create(shift=shift, start=start_at)
            snapshot_tasks(shift)
        elif shift.end_time is None:
            _resume(shift, now)  # back from a break: the same shift continues
        elif shift.ended_by != 'manual' or shift.rearmed:
            _reopen(shift)  # the day was closed, but the caretaker has come back: same day, same shift
            _resume(shift, now)
        # else: ended manually and the caretaker has not left range since: stay ended until they leave and return
        return current_shift(caretaker, now)

    # 3. Not near anyone. If a manual End was tapped, the next arrival may continue today's shift.
    if readings and all(s == 'out' for _, s, _ in readings):
        for s in shifts:
            if s.ended_by == 'manual' and not s.rearmed:
                s.rearmed = True
                s.save(update_fields=['rearmed'])
    return current_shift(caretaker, now)
```

### 6.2 Listing B.2 Tone shares and the angry-voices rule (ml/voice/infer.py, lines 45-71)

```python
    def analyze(self, audio):
        """audio: wav/flac/ogg bytes or a path. Returns a plain dict."""
        y = load_audio(audio)
        duration = len(y) / 16000.0
        windows = [w for w in split_windows(y) if not is_silent(w)]
        result = {'duration_s': round(duration, 1), 'windows': len(windows), 'speech_windows': 0,
                  'speech_s': 0.0, 'tones': {t: 0.0 for t in TONES}, 'dominant': None, 'distress': False}
        if not windows:
            return result

        probs = self._probabilities([mfcc(w) for w in windows])
        noise_i = CLASSES.index('noise')
        speech = probs[:, noise_i] < MAX_NOISE_PROB
        speech &= probs.argmax(axis=1) != noise_i
        if not speech.any():
            return result

        tone_p = probs[speech][:, :len(TONES)]
        tone_p = tone_p / tone_p.sum(axis=1, keepdims=True)  # shares among the five tones
        share = tone_p.mean(axis=0)
        result['speech_windows'] = int(speech.sum())
        result['speech_s'] = round(float(speech.sum()) * 1.5, 1)  # windows hop by 1.5 s
        result['tones'] = {t: round(float(s), 4) for t, s in zip(TONES, share)}
        result['dominant'] = TONES[int(share.argmax())]
        angry_i = TONES.index('angry')
        result['distress'] = int((tone_p[:, angry_i] >= self.angry_prob).sum()) >= self.angry_min_windows
        return result
```

### 6.3 Listing B.3 Checking the emailed sign-in code (backend/accounts/two_factor.py, lines 119-136)

```python
def verify(token, code):
    """The user behind this challenge if the code is right; otherwise a clear error."""
    challenge = _find(token)
    code = ''.join(ch for ch in str(code or '') if ch.isdigit())
    if challenge.attempts >= MAX_ATTEMPTS:
        challenge.delete()
        raise ValidationError({'detail': 'Too many wrong codes. Sign in again to get a new one.', 'expired': True})
    if not hmac.compare_digest(challenge.code_hash, _hash(code)):
        challenge.attempts += 1
        challenge.save(update_fields=['attempts'])
        left = MAX_ATTEMPTS - challenge.attempts
        if left <= 0:
            challenge.delete()
            raise ValidationError({'detail': 'Too many wrong codes. Sign in again to get a new one.', 'expired': True})
        raise ValidationError({'detail': f'That code is not right. {left} tr{"y" if left == 1 else "ies"} left.'})
    user = challenge.user
    challenge.delete()  # a code works once
    return user
```

### 6.4 Listing B.4 Ticking a task off with a photograph inside the geofence (backend/care/caretaker_views.py, lines 200-211 and 314-353)

```python
def require_in_range(user):
    """Refuse unless the caretaker's phone is verified within the geofence of an elderly person."""
    state, distance, _, _ = presence.current_reading(user, None)
    if state == 'in':
        return
    if state == 'out':
        raise PermissionDenied(
            f'You are about {round(distance)} m from the elderly person. Move within {presence.ENTER_RADIUS_M} m to mark this done.'
        )
    raise PermissionDenied(
        'Your location could not be verified. Turn on location sharing, make sure the elderly person is sharing too, then try again.'
    )

...

class TaskDoneView(APIView):
    """POST /api/tasks/<id>/done/ with a photo as the body: the caretaker ticks a task off, with proof."""

    parser_classes = [RawImageParser]

    def post(self, request, pk):
        user = request.user
        require_caretaker(user)
        task = Task.objects.filter(pk=pk, caretaker=user).select_related('caretaker', 'assigned_by').first()
        if not task:
            raise ValidationError({'detail': 'Task not found.'})
        photo = request.data
        if not isinstance(photo, (bytes, bytearray)) or not photo:
            raise ValidationError({'detail': 'Take a photo to show the task is done.'})
        if len(photo) > MAX_PHOTO_BYTES:
            return Response({'detail': 'The photo is too large. Try again.'}, status=413)
        kind = photo_type(photo)
        if not kind:
            raise ValidationError({'detail': 'That is not a photo the app can use (JPEG, PNG or WebP).'})
        if task.is_done:
            return Response(task_json(task))  # already ticked: a double tap must not add a second record
        require_in_range(user)  # a task can only be ticked off at the elderly person's side

        now = timezone.now()
        with transaction.atomic():
            task.is_done, task.done_at = True, now
            task.save()
            TaskCompletion.objects.create(
                task=task,
                caretaker=user,
                assigned_by=task.assigned_by,
                shift=next(iter(presence.todays_shifts(user, now)), None),
                title=task.title,
                recurring=task.recurring,
                done_at=now,
                photo=bytes(photo),
                photo_type=kind,
            )
            sync_chore(user, task)
        return Response(task_json(task), status=201)
```
