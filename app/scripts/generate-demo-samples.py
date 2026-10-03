"""Create the public, invented reports used by the one-click demo library."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
root = Path(__file__).resolve().parents[1] / 'apps/client/public/demo'
root.mkdir(parents=True, exist_ok=True)
for name, patient, identifier, note in [
 ('synthetic-lab.pdf', 'Asha Rao', 'P0482', 'Standard sample: compare every result with this source before approving.'),
 ('synthetic-identity-check.pdf', 'Asha Rao', None, 'Identity exercise: no patient identifier is printed on this report.'),
 ('synthetic-wrong-patient.pdf', 'Mira Sen', 'P0999', 'Assignment exercise: this report belongs to a different synthetic patient.'),
]:
 c=canvas.Canvas(str(root/name), pagesize=A4, invariant=True)
 c.setTitle('Glucoflow synthetic sample laboratory report')
 c.setFillColor(HexColor('#26796e'));c.roundRect(40,730,515,70,12,fill=1,stroke=0)
 c.setFillColor(HexColor('#ffffff'));c.setFont('Helvetica-Bold',18);c.drawString(56,773,'Glucoflow Demo Laboratory')
 c.setFont('Helvetica',10);c.drawString(56,751,'SYNTHETIC SAMPLE - NOT A REAL PATIENT RECORD')
 c.setFillColor(HexColor('#203b38'));c.setFont('Helvetica-Bold',16);c.drawString(48,695,'Laboratory report')
 c.setFont('Helvetica',11);c.drawString(48,666,'Patient name: '+patient)
 if identifier: c.drawString(48,646,'Patient ID: '+identifier)
 c.drawString(48,626,'Collected: 30 September 2026')
 c.drawString(48,606,'Reported: 01 October 2026')
 c.setFillColor(HexColor('#eff5f1'));c.rect(40,551,515,30,fill=1,stroke=0)
 c.setFillColor(HexColor('#203b38'));c.setFont('Helvetica-Bold',11)
 for x,text in [(48,'Test'),(300,'Result'),(350,'Unit'),(452,'Source range')]:c.drawString(x,561,text)
 rows=[('HbA1c','7.1','%','4.0-5.6'),('Fasting glucose','124','mg/dL','70-99'),('eGFR','72','mL/min/1.73 m2','>=90'),('Systolic blood pressure','132','mmHg',''),('Diastolic blood pressure','82','mmHg','')]
 for i,(test,value,unit,ref) in enumerate(rows):
  y=527-i*38;c.setFont('Helvetica',10)
  for x,text in zip([48,300,350,452],[test,value,unit,ref]):c.drawString(x,y,text)
  c.setStrokeColor(HexColor('#dce7e1'));c.line(40,y-12,555,y-12)
 c.setFont('Helvetica',10);c.drawString(48,275,'Reported by: Demo laboratory (synthetic)')
 c.setFont('Helvetica',9);c.drawString(48,250,note)
 c.setFillColor(HexColor('#5b706b'));c.drawString(48,85,'Invented names and measurements. For demonstrating Glucoflow only.')
 c.drawString(48,69,'Source reference ranges are supplied for review; this is not medical advice.')
 c.showPage();c.save()
 print(name)
