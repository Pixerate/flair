// flair-metal-hash: d0cf5850
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
    uint uAnimate;
    float uProgress;
    uint uFromTop;
    float uPanel;
    float uCut;
    float uTraces;
    float uGlitch;
    float3 uWire;
    float3 uTraceA;
    float3 uTraceB;
    float3 uTraceC;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_wireframe_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _120)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _265 = ts.x <= 1;
    bool _272;
    if (!_265)
    {
        _272 = ts.y <= 1;
    }
    else
    {
        _272 = _265;
    }
    bool _280;
    if (!_272)
    {
        _280 = _120.iResolution[0u] <= 0.0;
    }
    else
    {
        _280 = _272;
    }
    bool _287;
    if (!_280)
    {
        _287 = _120.iResolution[1u] <= 0.0;
    }
    else
    {
        _287 = _280;
    }
    if (_287)
    {
        return uv;
    }
    float boxAspect = _120.iResolution[0u] / _120.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _310;
    if (boxAspect > texAspect)
    {
        _310 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _310 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _310;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _120)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_120.uBackdrop) * _120.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_120.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _120)
{
    float4 _337;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _337 = overBackdrop(param, _120);
    }
    else
    {
        float2 param_1 = fract(uv);
        _337 = float4(testCard(param_1), 1.0);
    }
    return _337;
}

static inline __attribute__((always_inline))
float luma(thread const float3& c)
{
    return dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 panelAt(thread const float2& p, thread const float& size)
{
    float2 cell = floor(p / float2(size));
    float2 lo = cell * size;
    float2 hi = lo + float2(size);
    for (int k = 0; k < 4; k++)
    {
        float2 param = ((lo * 0.37000000476837158203125) + (hi * 0.10999999940395355224609375)) + float2(float(k) * 13.1000003814697265625);
        float h = hash12(param);
        if ((k > 0) && (h < 0.25))
        {
            break;
        }
        float2 param_1 = (lo + hi) + float2(float(k));
        float at = mix(0.25, 0.75, hash12(param_1));
        if (((hi.x - lo.x) * (0.60000002384185791015625 + h)) > (hi.y - lo.y))
        {
            float x = mix(lo.x, hi.x, at);
            if (p.x < x)
            {
                hi.x = x;
            }
            else
            {
                lo.x = x;
            }
        }
        else
        {
            float y = mix(lo.y, hi.y, at);
            if (p.y < y)
            {
                hi.y = y;
            }
            else
            {
                lo.y = y;
            }
        }
    }
    return float4((lo + hi) * 0.5, (hi - lo) * 0.5);
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _120)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _120);
    return pictureRGBA(tex, texSmplr, param_1, _120);
}

static inline __attribute__((always_inline))
float3 pictureCover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _120)
{
    float2 param = uv;
    return pictureCoverRGBA(tex, texSmplr, param, _120).xyz;
}

static inline __attribute__((always_inline))
float2 lumaAlpha(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _120)
{
    float2 param = uv;
    float4 c = pictureRGBA(tex, texSmplr, param, _120);
    return float2(dot(c.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)), c.w);
}

static inline __attribute__((always_inline))
float inkEdge(texture2d<float> tex, sampler texSmplr, thread const float2& uv, thread const float2& d, constant FlairUniforms& _120)
{
    float2 param = uv + float2(-d.x, d.y);
    float2 tl = lumaAlpha(tex, texSmplr, param, _120);
    float2 param_1 = uv + float2(0.0, d.y);
    float2 t = lumaAlpha(tex, texSmplr, param_1, _120);
    float2 param_2 = uv + d;
    float2 tr = lumaAlpha(tex, texSmplr, param_2, _120);
    float2 param_3 = uv - float2(d.x, 0.0);
    float2 l = lumaAlpha(tex, texSmplr, param_3, _120);
    float2 param_4 = uv + float2(d.x, 0.0);
    float2 r = lumaAlpha(tex, texSmplr, param_4, _120);
    float2 param_5 = uv - d;
    float2 bl = lumaAlpha(tex, texSmplr, param_5, _120);
    float2 param_6 = uv - float2(0.0, d.y);
    float2 b = lumaAlpha(tex, texSmplr, param_6, _120);
    float2 param_7 = uv + float2(d.x, -d.y);
    float2 br = lumaAlpha(tex, texSmplr, param_7, _120);
    float2 gx = ((((tr + (r * 2.0)) + br) - tl) - (l * 2.0)) - bl;
    float2 gy = ((((tl + (t * 2.0)) + tr) - bl) - (b * 2.0)) - br;
    return fast::max(length(float2(gx.x, gy.x)), length(float2(gx.y, gy.y)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _120, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_120.iResolution[0], _120.iResolution[1]);
    float2 uv = fitCoverUV(uImage, uImageSmplr, param, _120);
    float2 param_1 = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_1, _120);
    float3 param_2 = pic.xyz;
    float lum = luma(param_2);
    float cycle = fract(_120.iTime / 6.0);
    float _662;
    if (_120.uAnimate != 0u)
    {
        _662 = smoothstep(0.100000001490116119384765625, 0.5, cycle) * (1.0 - smoothstep(0.699999988079071044921875, 0.949999988079071044921875, cycle));
    }
    else
    {
        _662 = _120.uProgress;
    }
    float t = _662;
    float2 param_3 = fragCoord;
    float param_4 = _120.uPanel;
    float4 panel = panelAt(param_3, param_4);
    float2 local = fragCoord - panel.xy;
    float2 param_5 = panel.xy;
    float id = hash12(param_5);
    float2 param_6 = panel.xy / float2(_120.iResolution[0], _120.iResolution[1]);
    float3 param_7 = pictureCover(uImage, uImageSmplr, param_6, _120);
    float there = luma(param_7);
    float solid = smoothstep(_120.uCut * 0.4000000059604644775390625, _120.uCut, there);
    float chance = 0.3499999940395355224609375 + (0.64999997615814208984375 * smoothstep(_120.uCut, _120.uCut + 0.3499999940395355224609375, there));
    float2 param_8 = panel.xy + float2(21.700000762939453125);
    float lit = solid * smoothstep(-0.039999999105930328369140625, 0.039999999105930328369140625, chance - hash12(param_8));
    float border = fast::min(panel.z - abs(local.x), panel.w - abs(local.y));
    float wire = 1.0 - smoothstep(0.5, 1.2999999523162841796875, border);
    float _764;
    if (id > 0.5)
    {
        _764 = fract(fragCoord.x / 4.0);
    }
    else
    {
        _764 = fract(fragCoord.y / 4.0);
    }
    float hatch = _764;
    float _781;
    if (id < 0.07999999821186065673828125)
    {
        _781 = step(0.550000011920928955078125, fract((fragCoord.x + fragCoord.y) / 14.0));
    }
    else
    {
        _781 = 0.0;
    }
    float stripes = _781;
    float3 fill = ((_120.uWire * (0.62000000476837158203125 + (0.300000011920928955078125 * there))) * (1.0 - (0.25 * step(0.60000002384185791015625, hatch)))) * (1.0 - (0.75 * stripes));
    float3 col = mix(float3(0.0), float3(0.0900000035762786865234375, 0.0900000035762786865234375, 0.100000001490116119384765625), float3(solid));
    col = mix(col, fill, float3(lit));
    float2 param_9 = panel.xy + float2(3.2999999523162841796875);
    float traceId = hash12(param_9);
    float2 param_10 = panel.xy + float2(9.8999996185302734375);
    float side = hash12(param_10);
    float _845;
    if (side < 0.25)
    {
        _845 = panel.z + local.x;
    }
    else
    {
        float _856;
        if (side < 0.5)
        {
            _856 = panel.z - local.x;
        }
        else
        {
            float _867;
            if (side < 0.75)
            {
                _867 = panel.w + local.y;
            }
            else
            {
                _867 = panel.w - local.y;
            }
            _856 = _867;
        }
        _845 = _856;
    }
    float sideDist = _845;
    bool traced = (traceId < _120.uTraces) && (sideDist < 5.0);
    float _897;
    if (traced)
    {
        _897 = 1.0 - smoothstep(1.7999999523162841796875, 3.2000000476837158203125, sideDist);
    }
    else
    {
        _897 = wire;
    }
    float tw = _897;
    float3 _914;
    if (traceId < (_120.uTraces * 0.4000000059604644775390625))
    {
        _914 = _120.uTraceA;
    }
    else
    {
        float3 _926;
        if (traceId < (_120.uTraces * 0.75))
        {
            _926 = _120.uTraceB;
        }
        else
        {
            _926 = _120.uTraceC;
        }
        _914 = _926;
    }
    float3 trace = _914;
    float3 _940;
    if (traced)
    {
        _940 = trace;
    }
    else
    {
        _940 = _120.uWire;
    }
    col = mix(col, _940, float3(tw * solid));
    float2 param_11 = uv;
    float2 param_12 = float2(1.0) / float2(_120.iResolution[0], _120.iResolution[1]);
    float edge = smoothstep(0.25, 0.60000002384185791015625, inkEdge(uImage, uImageSmplr, param_11, param_12, _120));
    col = mix(col, _120.uWire, float3((edge * solid) * 0.800000011920928955078125));
    float2 block = floor(fragCoord / float2(_120.uPanel * 2.0));
    float along = (((block.y + 0.5) * _120.uPanel) * 2.0) / _120.iResolution[1u];
    float _998;
    if (_120.uFromTop != 0u)
    {
        _998 = 1.0 - along;
    }
    else
    {
        _998 = along;
    }
    float2 param_13 = block + float2(7.099999904632568359375);
    float order = (0.75 * _998) + (0.25 * hash12(param_13));
    float gap = (t * 1.2999999523162841796875) - order;
    float shown = step(0.0, gap);
    float front = (shown * (1.0 - step(0.07999999821186065673828125, gap))) * _120.uGlitch;
    float2 bit = floor(fragCoord / float2(6.0, 3.0));
    float2 param_14 = bit + float2(floor(_120.iTime * 14.0));
    float n = hash12(param_14);
    float3 noisy = floor((pic.xyz * 4.0) + float3(0.5)) / float3(4.0);
    float3 _1060;
    if (n > 0.75)
    {
        _1060 = float3(1.0, 0.300000011920928955078125, 0.85000002384185791015625);
    }
    else
    {
        float3 _1068;
        if (n > 0.60000002384185791015625)
        {
            _1068 = float3(0.300000011920928955078125, 1.0, 0.949999988079071044921875);
        }
        else
        {
            float3 _1076;
            if (n > 0.449999988079071044921875)
            {
                _1076 = float3(1.0);
            }
            else
            {
                _1076 = noisy * 1.39999997615814208984375;
            }
            _1068 = _1076;
        }
        _1060 = _1068;
    }
    noisy = _1060;
    float3 out_ = mix(col, pic.xyz, float3(shown));
    float2 param_15 = block + float2(floor(_120.iTime * 6.0));
    out_ = mix(out_, noisy, float3(front * step(0.3499999940395355224609375, hash12(param_15))));
    fragColor = float4(out_, fast::max(pic.w, solid * (1.0 - shown)));
}

fragment flair_wireframe_reveal_frag_out flair_wireframe_reveal_frag(constant FlairUniforms& _120 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_wireframe_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1134;
    if (_120.flair_flipY > 0.5)
    {
        _1134 = _120.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1134 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1134);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _120, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

