// flair-metal-hash: 51902a84
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uBlock;
    float uAmount;
    float uSmear;
    float uRate;
    float uBleed;
    char _m18_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_datamosh_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _183)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_183.uBackdrop) * _183.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_183.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _183)
{
    float4 _324;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _324 = overBackdrop(param, _183);
    }
    else
    {
        float2 param_1 = fract(uv);
        _324 = float4(testCard(param_1), 1.0);
    }
    return _324;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _183)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _183).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _183, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_183.iResolution[0], _183.iResolution[1]);
    float t = _183.iTime * _183.uRate;
    float epoch = floor(t);
    float ph = fract(t);
    float2 param = float2(epoch, 7.0);
    float on = step(1.0 - (_183.uAmount * 0.85000002384185791015625), hash12(param)) * smoothstep(0.0, 0.07999999821186065673828125, ph);
    float2 block = floor(fragCoord / float2(_183.uBlock));
    float2 field = (block * 0.119999997317790985107421875) + (float2(3.099999904632568359375, 1.7000000476837158203125) * epoch);
    float2 param_1 = field;
    float2 param_2 = field + float2(9.69999980926513671875);
    float2 mv = (float2(vnoise(param_1), vnoise(param_2)) * 2.0) - float2(1.0);
    float2 disp = (((mv * _183.uSmear) * ph) * on) * float2(_183.iResolution[1u] / _183.iResolution[0u], 1.0);
    float2 param_3 = block + float2(epoch * 13.0);
    float2 bh = hash22(param_3);
    float stuck = on * step(1.0 - (0.300000011920928955078125 * _183.uAmount), bh.x);
    float2 wrong = ((floor(bh * 6.0) - float2(2.5)) * _183.uBlock) / float2(_183.iResolution[0], _183.iResolution[1]);
    float2 st = uv + ((wrong + ((mv * 0.0199999995529651641845703125) * ph)) * stuck);
    float4 acc = float4(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 6; i++)
    {
        float k = float(i) / 5.0;
        float w = 0.4000000059604644775390625 + k;
        float2 param_4 = st - (disp * k);
        acc += (pictureRGBA(uImage, uImageSmplr, param_4, _183) * w);
        wsum += w;
    }
    float4 pic = acc / float4(wsum);
    float2 chromaUV = (((block * _183.uBlock) + float2(0.5)) / float2(_183.iResolution[0], _183.iResolution[1])) - (disp * 1.60000002384185791015625);
    float2 param_5 = chromaUV;
    float3 smeared = picture(uImage, uImageSmplr, param_5, _183);
    float y = dot(pic.xyz, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    float3 chroma = mix(pic.xyz - float3(y), smeared - float3(dot(smeared, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625))), float3(_183.uBleed * on));
    float3 col = float3(y) + (chroma * (1.0 + ((0.4000000059604644775390625 * on) * _183.uBleed)));
    float2 edge = abs(fract(fragCoord / float2(_183.uBlock)) - float2(0.5));
    col *= (1.0 - ((0.0599999986588954925537109375 * on) * step(0.4699999988079071044921875, fast::max(edge.x, edge.y))));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
}

fragment flair_datamosh_frag_out flair_datamosh_frag(constant FlairUniforms& _183 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_datamosh_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _625;
    if (_183.flair_flipY > 0.5)
    {
        _625 = _183.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _625 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _625);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _183, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

