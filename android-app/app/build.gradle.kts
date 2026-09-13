plugins {
    id("com.android.application")
}

android {
    namespace = "com.transportepoch.game"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.transportepoch.game"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "0.6.0"
    }

    sourceSets.getByName("main").assets.srcDir("../../docs/play")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
