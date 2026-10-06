import React, { useEffect, useRef, useState } from "react";
import { homeContent } from "./homeContent";
import { contactContent } from "./contactContent";
import { aboutContent } from "./aboutContent";
import { serviceContent } from "./serviceContent";
import { socialMediaContent } from "./socialMediaContent";
import { performanceContent } from "./performanceContent";
import { seoContent } from "./seoContent";
import { digitalMarketingContent } from "./digitalMarketingContent";
import { appDevelopmentContent } from "./appDevelopmentContent";
import { graphicContent } from "./graphicDesigningContent";
import { websiteContent } from "./websiteDevelopmentContent";
import { aeoContent } from "./aeoContent";
import { geoContent } from "./geoContent";
import { erpbizContent } from "./erpBusinessContent";
import { setupSiteEffects } from "./siteEffects";

function getView() {
  const hash = window.location.hash;
  if (hash === "#contact" || hash === "#contact-form") return "contact";
  if (hash === "#about") return "about";
  if (hash === "#services") return "services";
  if (hash === "#social-media-marketing") return "social";
  if (hash === "#performance-marketing") return "performance";
  if (hash === "#seo") return "seo";
  if (hash === "#digital-marketing") return "digital";
  if (hash === "#app-development") return "app";
  if (hash === "#graphic-designing") return "graphic";
  if (hash === "#website-development") return "website";
  if (hash === "#aeo") return "aeo";
  if (hash === "#geo") return "geo";
  if (hash === "#erp-business-software") return "erpbiz";
  return "home";
}

export default function App() {
  const siteRef = useRef(null);
  const [view, setView] = useState(getView);

  useEffect(() => {
    const onHashChange = () => setView(getView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!siteRef.current) return;
    const cleanup = setupSiteEffects(siteRef.current);
    const target = window.location.hash.replace("#", "");
    const timer = window.setTimeout(() => {
      if (target && target !== "contact" && target !== "contact-form") {
        document.getElementById(target)?.scrollIntoView({ behavior: "auto", block: "start" });
      } else if (target === "contact-form") {
        document.getElementById("contact-form")?.scrollIntoView({ behavior: "auto", block: "start" });
      }
    }, 30);
    return () => { window.clearTimeout(timer); cleanup?.(); };
  }, [view]);

  return (
    <main data-page-view={view} className={`tbm-app relative min-h-screen bg-black text-white overflow-x-hidden ${view === "about" ? "about-page" : view === "services" ? "service-page" : ["social","performance","seo","digital","app","graphic","website","aeo","geo","erpbiz"].includes(view) ? `social-page ${view}-page` : ""}`}>
      <div ref={siteRef} className="relative z-10 site-content">
        <div dangerouslySetInnerHTML={{ __html: view === "contact" ? contactContent : view === "about" ? aboutContent : view === "services" ? serviceContent : view === "social" ? socialMediaContent : view === "performance" ? performanceContent : view === "seo" ? seoContent : view === "digital" ? digitalMarketingContent : view === "app" ? appDevelopmentContent : view === "graphic" ? graphicContent : view === "website" ? websiteContent : view === "aeo" ? aeoContent : view === "geo" ? geoContent : view === "erpbiz" ? erpbizContent : homeContent }} />
      </div>
    </main>
  );
}
