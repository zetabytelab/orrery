#!/usr/bin/env python3
"""Ingest the Orrery demo estate into a DataHub instance.

Reads fixtures/estate.json and emits datasets (schema, description, owner, tags),
dataset-to-dataset lineage, the executive dashboard (consuming its upstream marts),
the churn ML model, and the orrery-* quality tags used by write-back.

Usage:
    export DATAHUB_GMS_URL=http://localhost:8080   # DATAHUB_GMS_TOKEN if needed
    uv run --with acryl-datahub ingest_estate.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

from datahub.emitter.mce_builder import make_data_flow_urn, make_data_job_urn, make_group_urn, make_tag_urn
from datahub.emitter.mcp import MetadataChangeProposalWrapper
from datahub.emitter.rest_emitter import DatahubRestEmitter
from datahub.metadata.schema_classes import (
    AuditStampClass,
    BooleanTypeClass,
    ChangeAuditStampsClass,
    DashboardInfoClass,
    DataFlowInfoClass,
    DataJobInfoClass,
    DataJobInputOutputClass,
    DatasetLineageTypeClass,
    DatasetPropertiesClass,
    EdgeClass,
    GlobalTagsClass,
    MLModelPropertiesClass,
    NumberTypeClass,
    OtherSchemaClass,
    OwnerClass,
    OwnershipClass,
    OwnershipTypeClass,
    SchemaFieldClass,
    SchemaFieldDataTypeClass,
    SchemaMetadataClass,
    StringTypeClass,
    TagAssociationClass,
    TagPropertiesClass,
    TimeTypeClass,
    UpstreamClass,
    UpstreamLineageClass,
)

ESTATE = json.loads((pathlib.Path(__file__).parent.parent / "fixtures" / "estate.json").read_text())

FIELD_TYPES = {
    "string": StringTypeClass,
    "boolean": BooleanTypeClass,
    "date": TimeTypeClass,
    "timestamp": TimeTypeClass,
    "double": NumberTypeClass,
    "long": NumberTypeClass,
}

AUDIT = AuditStampClass(time=0, actor="urn:li:corpuser:orrery")


def owned_by(team: str) -> OwnershipClass:
    return OwnershipClass(owners=[OwnerClass(owner=make_group_urn(team), type=OwnershipTypeClass.TECHNICAL_OWNER)])


def tagged(tags: list[str]) -> GlobalTagsClass:
    return GlobalTagsClass(tags=[TagAssociationClass(tag=make_tag_urn(t)) for t in tags])


def main() -> None:
    gms = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
    emitter = DatahubRestEmitter(gms_server=gms, token=os.environ.get("DATAHUB_GMS_TOKEN"))
    emitter.test_connection()
    emitted = 0

    def emit(urn: str, aspect: object) -> None:
        nonlocal emitted
        emitter.emit(MetadataChangeProposalWrapper(entityUrn=urn, aspect=aspect))
        emitted += 1

    # Quality tags that the write-back path applies (DataHub add_tags rejects unknown tags).
    for level in ("warning", "serious", "critical"):
        emit(make_tag_urn(f"orrery-{level}"), TagPropertiesClass(name=f"orrery-{level}", description=f"Orrery observed a {level}-grade data-quality incident on this asset."))

    for ds in ESTATE["datasets"]:
        urn = ds["urn"]
        emit(urn, DatasetPropertiesClass(name=ds["name"], description=ds["description"]))
        emit(urn, owned_by(ds["owner"]))
        emit(urn, tagged(ds["tags"]))
        emit(
            urn,
            SchemaMetadataClass(
                schemaName=ds["name"],
                platform=f"urn:li:dataPlatform:{ds['platform']}",
                version=0,
                hash="",
                platformSchema=OtherSchemaClass(rawSchema=""),
                fields=[
                    SchemaFieldClass(
                        fieldPath=f["field"],
                        type=SchemaFieldDataTypeClass(type=FIELD_TYPES.get(f["type"], StringTypeClass)()),
                        nativeDataType=f["type"],
                        description=f.get("description", ""),
                    )
                    for f in ds["schema"]
                ],
            ),
        )

    dataset_edges: dict[str, list[str]] = {}
    for edge in ESTATE["edges"]:
        if edge["downstream"].startswith("urn:li:dataset:"):
            dataset_edges.setdefault(edge["downstream"], []).append(edge["upstream"])
    for downstream, upstreams in dataset_edges.items():
        emit(
            downstream,
            UpstreamLineageClass(
                upstreams=[UpstreamClass(dataset=u, type=DatasetLineageTypeClass.TRANSFORMED) for u in upstreams],
            ),
        )

    for consumer in ESTATE["consumers"]:
        urn = consumer["urn"]
        inputs = [e["upstream"] for e in ESTATE["edges"] if e["downstream"] == urn]
        if consumer["type"] == "dashboard":
            emit(
                urn,
                DashboardInfoClass(
                    title=consumer["name"],
                    description=consumer["description"],
                    datasetEdges=[EdgeClass(destinationUrn=u) for u in inputs],
                    lastModified=ChangeAuditStampsClass(created=AUDIT, lastModified=AUDIT),
                ),
            )
        else:
            # Dataset -> training job -> model, so the model has real upstream lineage.
            flow_urn = make_data_flow_urn("airflow", "orrery_training", "PROD")
            job_urn = make_data_job_urn("airflow", "orrery_training", f"train_{consumer['name']}", "PROD")
            emit(flow_urn, DataFlowInfoClass(name="orrery_training", description="Weekly model training pipeline."))
            emit(job_urn, DataJobInfoClass(name=f"train_{consumer['name']}", type="SPARK", description=f"Trains {consumer['name']} from its feature tables."))
            emit(job_urn, DataJobInputOutputClass(inputDatasets=inputs, outputDatasets=[]))
            emit(
                urn,
                MLModelPropertiesClass(
                    name=consumer["name"],
                    description=consumer["description"],
                    trainingJobs=[job_urn],
                ),
            )
        emit(urn, owned_by(consumer["owner"]))
        emit(urn, tagged(consumer["tags"]))

    print(f"Emitted {emitted} aspects for {len(ESTATE['datasets'])} datasets and {len(ESTATE['consumers'])} consumers to {gms}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # noqa: BLE001
        print(f"ingestion failed: {err}", file=sys.stderr)
        sys.exit(1)
