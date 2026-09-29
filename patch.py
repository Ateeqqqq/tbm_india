from pathlib import Path
root=Path('/mnt/data/tbm_next/src')
menu='''<div class="service-nav-dropdown"><button class="service-dropdown-trigger" type="button">Services <span>⌄</span></button><div class="service-dropdown-menu"><a href="#performance-marketing">Performance Marketing</a><a href="#social-media-marketing">Social Media Marketing</a><a href="#seo">SEO</a><a href="#app-development">App Development</a><a href="#digital-marketing">Digital Marketing</a><a href="#website-development">Website Development</a><a href="#erp-business-software">ERP &amp; Business Software</a><a href="#graphic-designing">Graphic Designing</a><a href="#aeo">AEO</a><a href="#geo">GEO</a></div></div>'''
files=['serviceContent.js','socialMediaContent.js','performanceContent.js','seoContent.js','digitalMarketingContent.js','appDevelopmentContent.js']
for fname in files:
 p=root/fname; s=p.read_text(); start=s.find('<div class="service-nav-dropdown')
 if start<0: continue
 menu_start=s.find('<div class="service-dropdown-menu"',start)
 m=s.find('</div>', menu_start)
 end=s.find('</div>', m+6)+6
 if menu_start<0 or m<0 or end<6: continue
 s=s[:start]+menu+s[end:]
 p.write_text(s)

p=root/'App.jsx'; s=p.read_text()
s=s.replace('import { appDevelopmentContent } from "./appDevelopmentContent";','import { appDevelopmentContent } from "./appDevelopmentContent";\nimport { graphicContent } from "./graphicDesigningContent";\nimport { websiteContent } from "./websiteDevelopmentContent";\nimport { aeoContent } from "./aeoContent";\nimport { geoContent } from "./geoContent";\nimport { erpbizContent } from "./erpBusinessContent";')
s=s.replace('  if (hash === "#app-development") return "app";','  if (hash === "#app-development") return "app";\n  if (hash === "#graphic-designing") return "graphic";\n  if (hash === "#website-development") return "website";\n  if (hash === "#aeo") return "aeo";\n  if (hash === "#geo") return "geo";\n  if (hash === "#erp-business-software") return "erpbiz";')
s=s.replace('["social","performance","seo","digital","app"].includes(view)', '["social","performance","seo","digital","app","graphic","website","aeo","geo","erpbiz"].includes(view)')
s=s.replace('view === "app" ? appDevelopmentContent : homeContent', 'view === "app" ? appDevelopmentContent : view === "graphic" ? graphicContent : view === "website" ? websiteContent : view === "aeo" ? aeoContent : view === "geo" ? geoContent : view === "erpbiz" ? erpbizContent : homeContent')
p.write_text(s)
