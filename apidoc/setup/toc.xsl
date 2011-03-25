<!-- This stylesheet generates the XML-based TOC based on the current
     database contents. It is not run at user request time;
     we invoke it as part of the bulk content update process
     in the /apidoc/setup scripts.

     It is used both in rendering the HTML TOC as well as in
     driving the generation of function list pages.
-->
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:api="http://marklogic.com/rundmc/api"
  xmlns:apidoc="http://marklogic.com/xdmp/apidoc"
  xpath-default-namespace="http://www.w3.org/1999/xhtml"
  exclude-result-prefixes="xs api apidoc">

  <xsl:import href="../view/page.xsl"/>

  <xsl:include href="tocByCategory.xsl"/>

  <!-- Implements some common content fixup rules -->
  <xsl:include href="fixup.xsl"/>

  <xsl:template match="/">
    <toc>
      <node href="/"
            title="All functions"
            display="All functions ({$api:built-in-function-count + $api:library-function-count})"
            initially-expanded="yes"><!-- hidden="yes">-->
        <intro>
          <p xmlns="http://www.w3.org/1999/xhtml">The following table lists all functions in the MarkLogic API reference, including both built-in functions and functions implemented in XQuery library modules.</p>
        </intro>
        <xsl:apply-templates select="$api:built-in-libs | $api:library-libs">
          <xsl:sort select="."/>
        </xsl:apply-templates>
        <!--
        <node href="/built-in" display="Built-in functions ({$api:built-in-function-count})" title="All built-in functions">
          <intro>
            <p xmlns="http://www.w3.org/1999/xhtml">The following table lists all built-in functions, including both the standard XQuery functions (in the <code>fn:</code> namespace) and the MarkLogic extension functions.</p>
          </intro>
          <xsl:apply-templates select="$api:built-in-libs"/>
        </node>
        <node href="/library" display="Library functions ({$api:library-function-count})" title="All library functions">
          <intro>
            <p xmlns="http://www.w3.org/1999/xhtml">The following table lists all library functions, i.e. functions implemented in XQuery library modules that ship with MarkLogic Server.</p>
          </intro>
          <xsl:apply-templates select="$api:library-libs"/>
        </node>
        -->
      </node>
      <node display="Functions by category">
        <xsl:call-template name="functions-by-category"/>
      </node>
      <node href="/guides" display="User Guides">
        <node href="/guides/app-dev" display="Application Developer's Guide"/>
      </node>
    </toc>
  </xsl:template>

          <xsl:template match="api:lib">
            <node href="/{.}"
                  display="{api:prefix-for-lib(.)}: ({api:function-count-for-lib(.)})"
                  namespace="{api:uri-for-lib(.)}"
                  title="{api:prefix-for-lib(.)} functions">
              <xsl:if test="@built-in">
                <xsl:attribute name="footnote" select="'yes'"/>
              </xsl:if>
              <intro>
                <!--
                <xsl:apply-templates mode="render-summary" select="api:get-summary-for-lib(.)"/>
                -->
              </intro>
              <xsl:apply-templates select="api:function-names-for-lib(.)"/>
            </node>
          </xsl:template>

                  <!-- Wrap summary content with <p> if not already present -->
                  <xsl:template mode="render-summary" match="apidoc:summary[not(p)]">
                    <p xmlns="http://www.w3.org/1999/xhtml">
                      <xsl:next-match/>
                    </p>
                  </xsl:template>

                  <xsl:template mode="render-summary" match="apidoc:summary">
                    <xsl:apply-templates mode="fixup"/>
                  </xsl:template>


                  <xsl:template match="api:function-name">
                    <node href="/{.}" display="{.}" type="function"/>
                  </xsl:template>

</xsl:stylesheet>
