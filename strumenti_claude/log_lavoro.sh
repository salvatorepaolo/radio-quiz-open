#!/bin/bash
export PATH=/opt/homebrew/bin:$PATH
B=$(aws codebuild list-builds-for-project --region eu-south-1 --project-name "$(aws codebuild list-projects --region eu-south-1 --query 'projects[?starts_with(@, `CreaPiattaforme`)] | [0]' --output text)" --query 'ids[0]' --output text)
aws codebuild batch-get-builds --region eu-south-1 --ids "$B" --query 'builds[0].[buildStatus,currentPhase]' --output text
G=$(aws codebuild batch-get-builds --region eu-south-1 --ids "$B" --query 'builds[0].logs.groupName' --output text); S=$(aws codebuild batch-get-builds --region eu-south-1 --ids "$B" --query 'builds[0].logs.streamName' --output text)
aws logs get-log-events --region eu-south-1 --log-group-name "$G" --log-stream-name "$S" --query 'events[].message' --output text 2>&1 | tr '\t' '\n' | grep -v '^\s*$' | tail -${1:-20} | cut -c1-220
