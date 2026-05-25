// Available placeholders per template type:
//
// MC:       {{clinicName}} {{clinicAddress}} {{clinicPhone}}
//           {{patientName}} {{patientNric}} {{patientDob}}
//           {{mcDays}} {{mcStartDate}} {{mcEndDate}}
//           {{diagnosis}} {{doctorName}} {{date}}
//
// Referral: {{clinicName}} {{clinicAddress}} {{clinicPhone}}
//           {{patientName}} {{patientNric}} {{patientAge}}
//           {{referralTo}} {{referralFrom}} {{referralBody}}
//           {{diagnosis}} {{doctorName}} {{date}}

export const DEFAULT_MC_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #111827;
    padding: 48px;
    max-width: 800px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .letterhead { margin-bottom: 10px; }
  .clinic-name { font-size: 14pt; font-weight: bold; color: #1e3a5f; margin-bottom: 2px; }
  .clinic-meta { font-size: 9pt; color: #6b7280; line-height: 1.4; }
  .rule-thick { border: none; border-top: 2px solid #1e3a5f; margin: 0; }
  .rule-thin { border: none; border-top: 0.5px solid #1e3a5f; margin: 0; }
  .title-band { text-align: center; padding: 8px 0; }
  .title { font-size: 15pt; font-weight: bold; letter-spacing: 2px; color: #1e3a5f; }
  .date-row { text-align: right; margin: 14px 0 16px; font-size: 10pt; color: #6b7280; }
  .patient-box {
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 10px 14px;
    margin-bottom: 20px;
    background: #f9fafb;
  }
  .patient-row { display: flex; margin-bottom: 6px; }
  .patient-row:last-child { margin-bottom: 0; }
  .patient-label { width: 120px; font-size: 10pt; color: #6b7280; font-weight: bold; flex-shrink: 0; }
  .patient-value { font-size: 11pt; }
  .cert-para { font-size: 11pt; line-height: 1.6; color: #111827; margin-bottom: 16px; }
  .content { flex: 1; }
  .sig-block {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 48px;
  }
  .sig-line { border-bottom: 1px solid #111827; width: 160px; margin-bottom: 6px; }
  .sig-name { font-weight: bold; font-size: 11pt; margin-bottom: 2px; }
  .sig-subtitle { font-size: 10pt; color: #6b7280; margin-bottom: 2px; }
  .stamp-box {
    width: 80px;
    height: 80px;
    border: 1px dashed #d1d5db;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 8pt;
    color: #9ca3af;
  }
</style>
</head>
<body>
<div class="letterhead">
  <div class="clinic-name">{{clinicName}}</div>
  <div class="clinic-meta">{{clinicAddress}}</div>
  <div class="clinic-meta">Tel: {{clinicPhone}}</div>
</div>
<hr class="rule-thick" />
<div class="title-band"><span class="title">MEDICAL CERTIFICATE</span></div>
<hr class="rule-thin" />
<div class="date-row">Date Issued: <strong>{{date}}</strong></div>
<div class="patient-box">
  <div class="patient-row">
    <span class="patient-label">Patient Name</span>
    <span class="patient-value">{{patientName}}</span>
  </div>
  <div class="patient-row">
    <span class="patient-label">NRIC / ID</span>
    <span class="patient-value">{{patientNric}}</span>
  </div>
  <div class="patient-row">
    <span class="patient-label">Date of Birth</span>
    <span class="patient-value">{{patientDob}}</span>
  </div>
</div>
<div class="content">
  <p class="cert-para">
    This is to certify that the above-named patient was examined at our clinic and is certified
    medically unfit for work/school from <strong>{{mcStartDate}}</strong> to
    <strong>{{mcEndDate}}</strong> ({{mcDays}} day(s)).
  </p>
  <p class="cert-para">Diagnosis: {{diagnosis}}</p>
</div>
<div class="sig-block">
  <div>
    <div class="sig-line"></div>
    <div class="sig-name">{{doctorName}}</div>
    <div class="sig-subtitle">Medical Practitioner</div>
    <div class="sig-subtitle">Date: {{date}}</div>
  </div>
  <div class="stamp-box">Clinic<br>Stamp</div>
</div>
</body>
</html>`;

export const DEFAULT_REFERRAL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #111827;
    padding: 48px;
    max-width: 800px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .letterhead { margin-bottom: 10px; }
  .clinic-name { font-size: 14pt; font-weight: bold; color: #1e3a5f; margin-bottom: 2px; }
  .clinic-meta { font-size: 9pt; color: #6b7280; line-height: 1.4; }
  .rule-thick { border: none; border-top: 2px solid #1e3a5f; margin: 0; }
  .rule-thin { border: none; border-top: 0.5px solid #d1d5db; margin: 0; }
  .title-band { text-align: center; padding: 8px 0; }
  .title { font-size: 15pt; font-weight: bold; letter-spacing: 2px; color: #1e3a5f; }
  .date-row { text-align: right; margin: 14px 0 16px; font-size: 10pt; color: #6b7280; }
  .to-label { font-size: 10pt; font-weight: bold; margin-bottom: 3px; }
  .recipient-line { font-size: 11pt; margin-bottom: 14px; }
  .re-block { margin-bottom: 16px; }
  .re-row { display: flex; margin-bottom: 3px; align-items: baseline; }
  .re-label { font-weight: bold; font-size: 11pt; margin-right: 6px; width: 34px; flex-shrink: 0; }
  .re-patient { font-weight: bold; font-size: 11pt; }
  .re-meta { font-size: 9pt; color: #6b7280; margin-left: 40px; margin-bottom: 2px; }
  .body-text { font-size: 11pt; line-height: 1.6; margin-top: 4px; margin-bottom: 28px; flex: 1; }
  .sig-block { margin-top: 40px; }
  .sig-line { border-bottom: 1px solid #111827; width: 160px; margin-bottom: 6px; }
  .sig-name { font-weight: bold; font-size: 11pt; margin-bottom: 2px; }
  .sig-clinic { font-size: 10pt; color: #6b7280; }
</style>
</head>
<body>
<div class="letterhead">
  <div class="clinic-name">{{clinicName}}</div>
  <div class="clinic-meta">{{clinicAddress}}</div>
  <div class="clinic-meta">Tel: {{clinicPhone}}</div>
</div>
<hr class="rule-thick" />
<div class="title-band"><span class="title">REFERRAL LETTER</span></div>
<hr class="rule-thin" />
<div class="date-row">{{date}}</div>
<div>
  <div class="to-label">To:</div>
  <div class="recipient-line">{{referralTo}}</div>
</div>
<div class="re-block">
  <div class="re-row">
    <span class="re-label">Re:</span>
    <span class="re-patient">{{patientName}}</span>
  </div>
  <div class="re-meta">NRIC: {{patientNric}} &nbsp;|&nbsp; Age: {{patientAge}}</div>
  <div class="re-meta">Diagnosis: {{diagnosis}}</div>
</div>
<hr class="rule-thin" style="margin-bottom: 14px;" />
<div class="body-text">{{referralBody}}</div>
<div class="sig-block">
  <div class="sig-line"></div>
  <div class="sig-name">{{referralFrom}}</div>
  <div class="sig-clinic">{{clinicName}}</div>
</div>
</body>
</html>`;

export function fillPreviewData(html: string): string {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const data: Record<string, string> = {
    '{{clinicName}}': 'Iatrum Clinic',
    '{{clinicAddress}}': 'No 12, Jalan Setia, Taman Maju, 50000 Kuala Lumpur',
    '{{clinicPhone}}': '03-1234 5678',
    '{{patientName}}': 'Ahmad bin Abdullah',
    '{{patientNric}}': '900101-14-5678',
    '{{patientDob}}': '1 January 1990',
    '{{patientAge}}': '36',
    '{{mcDays}}': '2',
    '{{mcStartDate}}': '23 May 2026',
    '{{mcEndDate}}': '24 May 2026',
    '{{diagnosis}}': 'Acute Upper Respiratory Tract Infection',
    '{{doctorName}}': 'Dr. Demo Klinik',
    '{{date}}': today,
    '{{referralTo}}': 'Pakar Perubatan Dalaman, Hospital Kuala Lumpur',
    '{{referralFrom}}': 'Dr. Demo Klinik, Iatrum Clinic',
    '{{referralBody}}': 'Please assess and manage this patient who presents with the above condition.',
  };

  return Object.entries(data).reduce(
    (acc, [placeholder, value]) => acc.replaceAll(placeholder, value),
    html
  );
}