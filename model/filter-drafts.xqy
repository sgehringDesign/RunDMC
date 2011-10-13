(: These functions filter out draft and/or preview-only documents, when applicable. :)
module namespace draft = "http://developer.marklogic.com/site/internal/filter-drafts";

(: TODO: Use a special server field with xdmp:get-server-field instead of hard-coding the server name :)
declare variable $public-docs-only := xdmp:server-name(xdmp:server()) = ("CommunitySitePublic", "RunDMC-Public", "RunDMC2-Public");

(: Hide "Draft" documents, if applicable :)
declare function allow($doc) as element()?
{
  if ($public-docs-only) then $doc[(@status eq 'Published') and fn:not(@preview-only)]
                         else $doc
};

(: Hide preview-only docs from being listed on the site and admin interface :)
declare function listed($doc) as element()?
{
  $doc[allow(.) and fn:not(@preview-only)]
};
