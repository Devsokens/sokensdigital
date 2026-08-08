pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 25, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        COMPOSE_FILE         = 'docker-compose.ci.yml'
        // isole chaque build (nom de projet docker-compose unique) pour éviter
        // les collisions si plusieurs branches buildent en parallèle sur le même agent
        COMPOSE_PROJECT_NAME = "sokens-ci-${env.BRANCH_NAME}-${env.BUILD_NUMBER}".toLowerCase().replaceAll('[^a-z0-9_-]', '-')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build image de test') {
            steps {
                bat 'docker compose -f %COMPOSE_FILE% build test'
            }
        }

        stage('Lint') {
            steps {
                bat 'docker compose -f %COMPOSE_FILE% run --rm test flake8 technique/ administration/ core/ messaging/'
            }
        }

        stage('Vérification migrations') {
            steps {
                bat 'docker compose -f %COMPOSE_FILE% run --rm test python manage.py makemigrations --check --dry-run'
            }
        }

        stage('Tests — Techniques') {
            when {
                anyOf {
                    branch 'Herbert_technique'
                    branch 'taiger_technique'
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                bat 'docker compose -f %COMPOSE_FILE% run --rm test pytest technique/tests/ --cov=technique --cov-report=xml:reports/coverage-technique.xml --cov-report=html:htmlcov-technique --cov-fail-under=80 --junitxml=reports/junit-technique.xml -v'
            }
        }

        stage('Tests — Administration') {
            when {
                anyOf {
                    branch 'Herbert-_administration'
                    branch 'taiger_technique'
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                bat 'docker compose -f %COMPOSE_FILE% run --rm test pytest administration/tests/ --cov=administration --cov-report=xml:reports/coverage-administration.xml --cov-report=html:htmlcov-administration --cov-fail-under=80 --junitxml=reports/junit-administration.xml -v'
            }
        }

        stage('Tests — Messagerie') {
            when {
                anyOf {
                    branch 'taiger_technique'
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                bat 'docker compose -f %COMPOSE_FILE% run --rm test pytest messaging/tests/ --cov=messaging --cov-report=xml:reports/coverage-messaging.xml --cov-report=html:htmlcov-messaging --junitxml=reports/junit-messaging.xml -v'
            }
        }

        stage('Tests — Core (branches partagées uniquement)') {
            when {
                anyOf {
                    branch 'taiger_technique'
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                // core/tests.py est un fichier, pas un dossier — 'core/tests/'
                // (avec slash) ne matchait aucun test, bug pré-existant.
                bat 'docker compose -f %COMPOSE_FILE% run --rm test pytest core/tests.py --junitxml=reports/junit-core.xml -v'
            }
        }
    }

    post {
        always {
            // returnStatus: true => n'échoue pas le post même si le "down" retourne une erreur
            bat(script: 'docker compose -f %COMPOSE_FILE% down -v --remove-orphans', returnStatus: true)

            junit allowEmptyResults: true, testResults: 'backend/reports/junit-*.xml'

            script {
                try {
                    if (fileExists('backend/htmlcov-technique/index.html')) {
                        publishHTML(target: [
                            reportDir: 'backend/htmlcov-technique',
                            reportFiles: 'index.html',
                            reportName: 'Couverture — Techniques',
                            keepAll: true,
                            alwaysLinkToLastBuild: true
                        ])
                    }
                    if (fileExists('backend/htmlcov-administration/index.html')) {
                        publishHTML(target: [
                            reportDir: 'backend/htmlcov-administration',
                            reportFiles: 'index.html',
                            reportName: 'Couverture — Administration',
                            keepAll: true,
                            alwaysLinkToLastBuild: true
                        ])
                    }
                    if (fileExists('backend/htmlcov-messaging/index.html')) {
                        publishHTML(target: [
                            reportDir: 'backend/htmlcov-messaging',
                            reportFiles: 'index.html',
                            reportName: 'Couverture — Messagerie',
                            keepAll: true,
                            alwaysLinkToLastBuild: true
                        ])
                    }
                } catch (e) {
                    echo "Note: publishHTML non disponible sur ce serveur Jenkins (plugin HTML Publisher non installé)."
                }
            }
        }
        failure {
            echo "❌ Build en échec sur la branche ${env.BRANCH_NAME} (build #${env.BUILD_NUMBER})"
        }
        success {
            echo "✅ Build réussi sur la branche ${env.BRANCH_NAME}"
        }
    }
}
