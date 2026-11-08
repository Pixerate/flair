// flair-metal-hash: 0ca22d9b
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uWidth;
    float uHeight;
    float uRound;
    float uRefraction;
    float uZoom;
    float uDispersion;
    char _m19_pad[8];
    packed_float3 uTint;
    float uTintAlpha;
    float uRim;
    uint uDemo;
    char _m23_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_liquid_glass_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _90)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_90.uBackdrop) * _90.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_90.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _90)
{
    float4 _232;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _232 = overBackdrop(param, _90);
    }
    else
    {
        float2 param_1 = fract(uv);
        _232 = float4(testCard(param_1), 1.0);
    }
    return _232;
}

static inline __attribute__((always_inline))
float boxSdf(thread const float2& p, thread const float2& b, thread const float& r)
{
    float2 q = (abs(p) - b) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _90)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _90).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _90, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_90.iResolution[0], _90.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _90);
    float2 drift = float2(_90.iResolution[0], _90.iResolution[1]) * (float2(0.5) + float2(0.2199999988079071044921875 * sin(_90.iTime * 0.5), 0.180000007152557373046875 * sin((_90.iTime * 0.709999978542327880859375) + 1.0)));
    float2 _297;
    if (_90.uDemo != 0u)
    {
        _297 = drift;
    }
    else
    {
        _297 = float2(_90.iResolution[0], _90.iResolution[1]) * 0.5;
    }
    float2 c = mix(_297, _90.iPointer.xy, float2(fast::clamp(_90.iPointer.z, 0.0, 1.0)));
    float2 hs = (float2(_90.uWidth, _90.uHeight) * 0.5) * _90.iResolution[1u];
    float rad = _90.uRound * fast::min(hs.x, hs.y);
    float2 q = fragCoord - c;
    float2 param_1 = q;
    float2 param_2 = hs;
    float param_3 = rad;
    float sd = boxSdf(param_1, param_2, param_3);
    float bezel = 0.449999988079071044921875 * fast::min(hs.x, hs.y);
    float3 col = pic.xyz;
    float2 param_4 = q + float2(0.0, 0.119999997317790985107421875 * bezel);
    float2 param_5 = hs;
    float param_6 = rad;
    col *= (1.0 - ((0.25 * exp((-fast::max(boxSdf(param_4, param_5, param_6), 0.0)) / (0.5 * bezel))) * step(0.0, sd)));
    float inside = fast::clamp(0.5 - sd, 0.0, 1.0);
    if (inside > 0.0)
    {
        float e = 1.0;
        float2 param_7 = q + float2(e, 0.0);
        float2 param_8 = hs;
        float param_9 = rad;
        float2 param_10 = q - float2(e, 0.0);
        float2 param_11 = hs;
        float param_12 = rad;
        float2 param_13 = q + float2(0.0, e);
        float2 param_14 = hs;
        float param_15 = rad;
        float2 param_16 = q - float2(0.0, e);
        float2 param_17 = hs;
        float param_18 = rad;
        float2 nrm = fast::normalize(float2(boxSdf(param_7, param_8, param_9) - boxSdf(param_10, param_11, param_12), boxSdf(param_13, param_14, param_15) - boxSdf(param_16, param_17, param_18)) + float2(9.9999999747524270787835121154785e-07));
        float rimK = 1.0 - fast::clamp((-sd) / bezel, 0.0, 1.0);
        float bend = ((((rimK * rimK) * rimK) * _90.uRefraction) * bezel) * 1.60000002384185791015625;
        float2 base = (c + (q / float2(_90.uZoom))) - (nrm * bend);
        float disp = (_90.uDispersion * 0.25) * rimK;
        float2 off = (nrm * bend) * disp;
        float2 param_19 = (base + off) / float2(_90.iResolution[0], _90.iResolution[1]);
        float2 param_20 = base / float2(_90.iResolution[0], _90.iResolution[1]);
        float2 param_21 = (base - off) / float2(_90.iResolution[0], _90.iResolution[1]);
        float3 glass = float3(picture(uImage, uImageSmplr, param_19, _90).x, picture(uImage, uImageSmplr, param_20, _90).y, picture(uImage, uImageSmplr, param_21, _90).z);
        glass = mix(glass, float3(_90.uTint), float3(_90.uTintAlpha));
        float lit = dot(nrm, float2(-0.60000002384185791015625, 0.800000011920928955078125));
        float rim = exp(-powr(sd / 1.5, 2.0));
        float spec = powr(fast::max(lit, 0.0), 3.0) + (0.3499999940395355224609375 * powr(fast::max(-lit, 0.0), 3.0));
        glass += float3(_90.uRim * ((rim * (0.3499999940395355224609375 + (0.64999997615814208984375 * spec))) + ((((0.3499999940395355224609375 * spec) * rimK) * rimK) * rimK)));
        glass += float3(((_90.uRim * 0.0500000007450580596923828125) * (1.0 - rimK)) * (0.5 + ((0.5 * q.y) / fast::max(hs.y, 1.0))));
        col = mix(col, glass, float3(inside));
    }
    fragColor = float4(col, fast::max(pic.w, inside));
}

fragment flair_liquid_glass_frag_out flair_liquid_glass_frag(constant FlairUniforms& _90 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_liquid_glass_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _622;
    if (_90.flair_flipY > 0.5)
    {
        _622 = _90.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _622 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _622);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _90, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

