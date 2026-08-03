@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF)
@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup batch script
@IF "%__MVNW_ARG0_NAME__%"=="" (SET __MVNW_ARG0_NAME__=%~nx0)
@SET DP0=%~dp0

@SET MAVEN_PROJECTBASEDIR=%MAVEN_BASEDIR%
@IF NOT "%MAVEN_PROJECTBASEDIR%"=="" goto endDetectBaseDir
@SET EXEC_DIR=%CD%
@SET WDIR=%EXEC_DIR%

:findBaseDir
IF EXIST "%WDIR%"\.mvn goto baseDirFound
cd ..
SET WDIR=%CD%
goto findBaseDir

:baseDirFound
SET MAVEN_PROJECTBASEDIR=%WDIR%
cd "%EXEC_DIR%"

:endDetectBaseDir

@SET WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

@SET WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar"
@SET WRAPPER_PROPERTIES="%MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties"

@SET DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.3.2/maven-wrapper-3.3.2.jar"

FOR /F "usebackq tokens=1,2 delims==" %%A IN (%WRAPPER_PROPERTIES%) DO (
    IF "%%A"=="wrapperUrl" SET DOWNLOAD_URL=%%B
)

@IF EXIST %WRAPPER_JAR% (
    SET INIT_SCRIPT="%MAVEN_PROJECTBASEDIR%\mvnw.cmd"
) ELSE (
    SET INIT_SCRIPT="%TEMP%\mvn_tmp_mvnw_download.%RANDOM%"
)

@SET JAVA_HOME_TEMP=%JAVA_HOME%
@IF NOT "%JAVA_HOME_TEMP%"=="" (
    @SET JAVA_BIN=%JAVA_HOME_TEMP%\bin\java.exe
) ELSE (
    @SET JAVA_BIN=java
)

@%JAVA_BIN% -cp %WRAPPER_JAR% "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*

@SET MAVEN_EXITCODE=%ERRORLEVEL%
@EXIT /B %MAVEN_EXITCODE%